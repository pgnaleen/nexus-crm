# Allow multiple Relationship Types to share the same systemRole

**Note:** on approval, step 0 of implementation is committing this plan as
`_bmad-output/planning-artifacts/plan-multi-type-system-role.md`, matching this project's
existing convention — plan mode itself only permits editing this scratch file.

## Context

Today `relationship_types.system_role` (Customer/Partner) is constrained to at most one row per
tenant per role — a partial unique index plus an app-level pre-check. The user wants multiple
distinctly-named types (e.g. "GTC Reseller", "Technology Partner") to all count as Partner
simultaneously, so Add Deal's Partners picker pulls from the union of every type flagged Partner
(same idea for Customer). This removes the one-per-role constraint and changes resolution from
"the one type" to "the set of types," with the two picker queries matching against that set
instead of a single id, deduplicated.

## Design

### 1. Migration
New file, next timestamp after `1784700000007`, dropping only the unique index (column/enum type
untouched):
```sql
DROP INDEX "UQ_relationship_types_tenant_system_role";
```
`down()` recreates it exactly as the original migration did, for a clean revert path.

### 2. `backend/src/modules/relationship-types/relationship-types.service.ts`
- Delete `assertSystemRoleAvailable` entirely, and its two call sites (in `create()` and
  `update()`, both guarded by `if (dto.systemRole != null)`) — there's no longer a conflict to
  pre-check. Confirm at implementation time whether `BadRequestException` is still used elsewhere
  in this file before removing its import.
- Rename `findSystemRoleTypeId(role): Promise<string | null>` to
  `findSystemRoleTypeIds(role): Promise<string[]>`, switching `findOneScoped` to `findScoped`
  (same `where: { systemRole: role }` filter, now returning every match instead of the first).

### 3. `backend/src/modules/pickers/pickers.controller.ts`
`findRolePickerParties` changes its empty-check from `!typeId` to `typeIds.length === 0`
(`configured: false` when no type holds the role, same as before — just now checking array
emptiness), and passes the array through to both services instead of a single id. The two public
routes (`findDealCustomerParties`/`findDealPartnerParties`) don't change at all — they only call
this helper.

### 4. `backend/src/modules/companies/companies.service.ts`
`findPickerForRelationshipType(relationshipTypeId: string)` → accepts `relationshipTypeIds:
string[]`; join condition becomes `party.relationship_type_id IN (:...relationshipTypeIds)`.
**Must add `.distinct()`** to the query — `relationship_company_contact_map` has no unique
constraint on `(company_id, relationship_type_id)`, so a company tagged under two different
Partner-flagged types would otherwise join-produce two rows for the same company.

### 5. `backend/src/modules/contacts/contacts.service.ts`
Same rename or `relationshipTypeIds: string[]`; the subquery's `WHERE relationship_type_id =
:relationshipTypeId` becomes `WHERE relationship_type_id IN (:...relationshipTypeIds)`. **No
`.distinct()` needed** — this is `contact.id IN (SELECT ...)`, a membership test against the outer
`contact` query, not a join, so it can't produce duplicate outer rows regardless of how many
subquery rows match.

### 6. Frontend copy only
`frontend/src/locales/en.json`'s `relationshipTypes.dialog.systemRoleHelp` currently ends "Only
one type per role." — remove that sentence (it becomes false). Confirmed via investigation:
neither `RelationshipTypeFormDialog.tsx` nor `RelationshipTypesWidget.tsx` has any client-side
one-per-role logic (no fetching of sibling rows, no disabling of options) — this is a pure copy
fix, no component logic changes.

### Explicitly unchanged
- `common/src/contracts/pickers.contracts.ts`'s `RelationshipRolePickerResponse` shape
  (`configured`/`companies`/`contacts`) — already correct for a deduplicated union.
- `AddDealDialog.tsx` — consumes the same response shape, needs zero changes.
- `TenantsService.create()`'s seeding (one default Customer + one default Partner per new
  tenant) — seeding one of each is a convenience default, not a maximum; still correct unchanged.
- The `RelationshipTypeFormDialog.tsx` System Role select stays a plain 3-option
  None/Customer/Partner dropdown — no new UI needed, since the constraint being removed was
  purely a backend one.

## Verification
1. Backend typecheck clean, zero new errors beyond the pre-existing baseline.
2. Flag two different Relationship Types as Partner in the same tenant — confirm the second flag
   now succeeds (previously a 400).
3. Tag a company under Partner-Type-A only, tag a different company under Partner-Type-B only,
   tag one more company under *both* — call `GET /pickers/deal-partner-parties` and confirm all
   three companies appear exactly once each (proves the union + dedup works, not just the second
   flag succeeding).
4. Confirm `GET /pickers/deal-customer-parties` is unaffected when only Customer has a single
   flagged type (regression check on the common case).
5. Unflag both Partner types (back to zero) — confirm `configured: false` again, matching the
   pre-existing empty-state behavior.
6. Frontend: open Relationship Types admin, confirm the System Role field's help text no longer
   claims "only one type per role."
