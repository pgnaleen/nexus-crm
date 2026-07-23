# Filter Add Deal's Customer/Partners pickers by tenant-flagged Relationship Type

## Context

Add Deal's Customer field and Partners field currently show every Company/Contact in the
tenant, unfiltered — this is documented bug **F2** in
`_bmad-output/implementation-artifacts/todo-master-remaining-work.md`. Neither
`companies.service.ts::findPicker` nor `contacts.service.ts::findPicker` joins
`relationship_company_contact_map`, so a company tagged "Vendor," or untagged entirely, is
indistinguishable from one tagged "Customer."

Rejected approach: hardcoding a name-matched "Customer"/"Partner" row per tenant. Breaks the
moment a tenant renames that row (names are fully tenant-editable), forces special-cased
"can't delete this row" guard code sprinkled through the delete path, and creates duplicate
concepts for tenants who already have an equivalently-meaning row under a different name.

Agreed approach instead: a nullable `systemRole` flag (`CUSTOMER`/`PARTNER`/null) on
`relationship_types`, set via a toggle on the existing admin form. The flag travels with the
row's id, so renaming/deleting/re-flagging never breaks anything — no special-cased code
anywhere. New tenants get two default rows pre-flagged, purely as an onboarding convenience,
never as a hardcoded/undeletable rule.

## Design

### 1. Migration
New file `backend/src/database/migrations/1784700000005-AddRelationshipTypeSystemRole.ts`:
```sql
CREATE TYPE "public"."relationship_types_system_role_enum" AS ENUM('customer', 'partner');
ALTER TABLE "relationship_types" ADD "system_role" "public"."relationship_types_system_role_enum";
CREATE UNIQUE INDEX "UQ_relationship_types_tenant_system_role"
  ON "relationship_types" ("tenant_id", "system_role")
  WHERE "system_role" IS NOT NULL AND "deleted_at" IS NULL;
```
The `deleted_at IS NULL` clause is required — without it, soft-deleting the flagged row would
permanently occupy that (tenant, role) slot and block ever flagging a replacement. `down()`
reverses in order: drop index, drop column, drop type. Matches `1784600000000-CreateDealPartnersMap.ts`'s
partial-index style and `1784214181322-ConvertDealSourceCategoryToEnum.ts`'s enum-column style.

### 2. `common` package
- New `common/src/enums/system-role.enum.ts`: `SystemRole { Customer = "customer", Partner = "partner" }`, exported from `common/src/enums/index.ts`.
- `common/src/contracts/relationship-types.contracts.ts`: add `systemRole: SystemRole | null` to `RelationshipTypeResponse`, `systemRole?: SystemRole | null` to both request interfaces.
- New `common/src/contracts/relationship-role-picker.contracts.ts`: `RelationshipRolePickerResponse { configured: boolean; companies: CompanyPickerResponse[]; contacts: ContactPickerResponse[]; }` — `configured` is what lets the frontend distinguish "no type flagged yet" from "a type is flagged but nothing's tagged." Export from `common/src/contracts/index.ts`.

### 3. Backend `relationship-types` module
- **Entity**: add `@Column({ type: "enum", enum: SystemRole, name: "system_role", nullable: true }) systemRole?: SystemRole | null;`
- **DTOs** (create + update): add `@IsOptional() @IsEnum(SystemRole) systemRole?: SystemRole | null;`
- **`relationship-types.service.ts`**:
  - New private `assertSystemRoleAvailable(role, excludeId?)` — looks up any existing row already flagged with that role (`findOneScoped({ where: { systemRole: role } })`); if found and its id differs from `excludeId`, throws `BadRequestException` naming the conflicting row. Called from `create()`/`update()` whenever `dto.systemRole` is non-null, turning what would be a raw partial-unique-index 500 into a clean 400.
  - `update()`: generalize its current hand-written single-field (`name`-only) audit diff into the generic `Object.keys(dto)` loop already used in `deal-sources.service.ts::update()` (reference pattern, copy exactly), so `systemRole` changes get audited automatically and every touched method gets the entry/success/error debug-log lines CLAUDE.md requires.
  - New `findSystemRoleTypeId(role): Promise<string | null>` — resolves the flagged row's id for a role, used by the picker endpoints below.
  - `remove()`: no change — deleting a flagged row frees the slot for free, nothing to special-case.
  - **Add `exports: [RelationshipTypesService]` to `RelationshipTypesModule`** — currently missing entirely (verified by reading the file), and `PickersModule` needs to inject this service.
- **Controller**: `toResponse()` adds `systemRole: type.systemRole ?? null`.

### 4. New role-scoped picker endpoints
Ownership split: `RelationshipTypesService` resolves which type id is flagged; `CompaniesService`/`ContactsService` do the filtered query (new sibling method next to their existing `findPicker`); `PickersController` orchestrates both, exactly like it already does for the existing plain pickers.

- `CompaniesRepository`: new `findPickerForRelationshipType(relationshipTypeId)` — inner-joins `relationship_company_contact_map` on `company_id` + `relationship_type_id`, `deleted_at IS NULL`.
- `ContactsRepository`: new `findPickerForRelationshipType(relationshipTypeId)` — matches contacts **either** directly tagged via their own map row **or** owned by a company that has a map row for that type (an OR of two subqueries). This preserves the existing UX where a company-owned contact is independently pickable, and correctly inherits its parent company's tag — company-owned contacts deliberately don't get their own map row per the double-counting fix from 2026-07-22, so without this OR they'd vanish from the filtered list entirely.
- `PickersController`: two new routes, `GET /pickers/deal-customer-parties` and `GET /pickers/deal-partner-parties`, gated on `[PERMISSIONS.DEALS_VIEW]` only (matches the existing `/pickers/contacts` gate — Add Deal is the only real caller). Each: resolve the role's flagged type id via `RelationshipTypesService.findSystemRoleTypeId`; if null, return `{ configured: false, companies: [], contacts: [] }`; otherwise run both filtered queries in parallel and return `{ configured: true, companies: [...], contacts: [...] }`. Standard debug-log entry/branch/result + try/catch-rethrow throughout.
- `PickersModule`: add `RelationshipTypesModule` to `imports`. No circular-import risk — confirmed `RelationshipTypesModule` doesn't depend on `PickersModule`/`CompaniesModule`/`ContactsModule` as Nest modules (it already injects `CompaniesRepository`/`ContactsRepository` directly as providers).
- Update `_bmad-output/implementation-artifacts/api-endpoint-registry.md` with the two new rows in the same change.

### 5. Tenant-creation seeding
`TenantsService` currently has no `DataSource` injected (confirmed by reading the file) — add `@InjectDataSource() private readonly dataSource: DataSource`, matching the exact pattern already used in `relationship-types.service.ts::remove()`. Wrap `create()`'s tenant insert and the two seed rows in one `dataSource.transaction(...)`, so a seeding failure rolls back the tenant too rather than leaving it half-provisioned:
- Insert the `Tenant` row as today.
- Insert two `RelationshipType` rows scoped to the *new* tenant's id (set `tenantId` explicitly on the entity, not via `createScoped`, which would resolve the current request's tenant context — the same reasoning already used in `relationship-parties.service.ts`'s own cross-tenant-safe inserts): `{ name: "Customer", systemRole: Customer }`, `{ name: "Partner", systemRole: Partner }`.
- Existing audit-log call for the tenant stays; no separate audit calls needed for the two seed rows (they're provisioning defaults, not a user-driven mutation — consistent with `seed.ts`'s own reference-data inserts never being audit-logged either).
- No backfill for already-existing tenants (today just the one `System` tenant, post-wipe) — the "unconfigured" empty state is a fully supported, correct state, not a bug to patch around. Two clicks in the existing admin UI covers it if wanted.

### 6. Frontend
- `frontend/src/lib/api/pickers.ts` + `frontend/src/lib/pickers/server.ts`: two new functions each (`getDealCustomerParties`/`getDealPartnerParties`), same `apiFetch`/`serverFetch` shape as existing sibling functions.
- `frontend/src/app/[tenant]/(dashboard)/funnel/page.tsx`: fetch both, pass down as two new props alongside the existing (unchanged) `companies`/`contacts` props — those stay unfiltered since `AddDealDialog` still needs them for `companyNameById`, `primaryContactOptions`, and edit-mode partner display.
- `AddDealDialog.tsx`: rebuild `otherPartyOptions` from the new `customerParties` prop/state instead of raw `companies`/`contacts`; same for `partnerOptions` from `partnerParties`. Extend `refreshPickers()` to also refresh these two. Add a two-branch empty state around each field — modeled on this same file's existing `ChooseRelationshipTypeDialog` precedent (a plain message instead of the picker when the options array is empty), not `SearchSelect`'s `emptyLabel` prop (that only covers "search matched nothing"): `!configured` → "no Customer/Partner type set up yet, go to Relationship Types admin"; `configured && options.length === 0` → "nothing tagged yet."
- `RelationshipTypeFormDialog.tsx`: add a `systemRole` field to `FormState`, rendered as a `CustomSelect` (None/Customer/Partner), disabled in view mode. Backend's 400 on a duplicate flag attempt surfaces automatically through the existing `err instanceof ApiError` catch — no new error-handling code needed.
- `RelationshipTypesWidget.tsx`: add a "System Role" column showing Customer/Partner/— per row.
- New i18n keys in `frontend/src/locales/en.json` under `relationshipTypes.dialog`/`relationshipTypes.table` and `addDealDialog.customer`/`addDealDialog.partners`, for every new string introduced by this change (existing strings in these files stay as-is, out of scope per the project's "new code follows the rule, old code catches up later" i18n precedent).

## Implementation order (checkpoints — verify before moving on)

1. **Migration + entity + common package.** Verify via `psql`: column + index exist, two same-role inserts collide, insert-after-soft-delete-of-the-holder succeeds.
2. **Backend CRUD** (DTOs, `assertSystemRoleAvailable`, generalized `update()`, `toResponse`, module export fix). Verify via `curl`: flag/unflag/re-flag, duplicate-flag returns a clean 400 not a 500.
3. **Frontend admin toggle** (`RelationshipTypeFormDialog.tsx`, `RelationshipTypesWidget.tsx`). Verify visually in the browser.
4. **Picker endpoints** (`RelationshipTypesService.findSystemRoleTypeId`, repo methods, `PickersController` routes, module wiring, registry doc). Verify via `curl` for all three states: unconfigured, configured-but-empty, configured-with-data — including the company-owned-contact-inherits-tag case specifically.
5. **Tenant-creation seeding** (`TenantsService` transaction). Verify by creating a real tenant and confirming the two default rows appear already flagged.
6. **`AddDealDialog.tsx` rewire** (props, options rebuild, empty states, i18n). Final full visual pass in the browser: unconfigured state, configured-empty state, configured-with-data state, rename-doesn't-break-it, delete-flagged-row-then-reflag-a-different-one.

## Verification (end-to-end, after all checkpoints)

1. New tenant → Relationship Types admin shows exactly two rows, pre-flagged.
2. Add Deal before tagging anything → both fields show "nothing tagged yet" (not every company/contact).
3. Tag a company + a standalone contact as Customer, a different company as Partner → Add Deal shows exactly those (plus the tagged company's own contacts, inherited) per field.
4. Unflag Customer → Add Deal's Customer field shows the "not configured" message; Partners unaffected.
5. Attempt to flag a second row the same role while one's already flagged → clean 400 in the form.
6. Soft-delete the flagged Partner row → flag a different row as Partner → succeeds (validates the `deleted_at IS NULL` index condition).
7. Rename the flagged Customer row → Add Deal still resolves it correctly (validates id-based, not name-based, matching).
8. `docker exec orelia-backend-1`/`orelia-frontend-1` typecheck clean beyond the existing pre-existing baseline throughout.
