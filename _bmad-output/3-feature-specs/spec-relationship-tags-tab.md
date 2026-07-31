---
title: 'Relationship Tags Tab for Company/Contact Dialogs'
type: 'feature'
created: '2026-07-30'
status: 'done'
review_loop_iteration: 2
context: []
baseline_commit: '6b259a88c228a757b66b1d48dd2f37b1f112e202'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Company/Contact can be tagged under multiple Relationship Types independently, but there's no screen showing all of *one* party's current tags together, and no way to tag an existing party into an additional type without leaving to that type's own admin page.

**Approach:** Add a "Relationships" tab to `CompanyFormDialog.tsx`/`ContactFormDialog.tsx` that renders a hub-and-spoke diagram of the party's current tags (view mode) and lets the user add a new tag via a filtered picker (edit mode), backed by two new cross-relationship-type endpoints.

## Boundaries & Constraints

**Always:**
- Reuse existing `RELATIONSHIP_VIEW`/`RELATIONSHIP_CREATE` permissions — no new permission keys.
- Every new mutation sets `createdBy` and writes an `audit_logs` row (`entityType: "relationship_company_contact_map"`).
- Never `save()`/`saveScoped()` an entity loaded with relations.
- New tab content wrapped in the dialog's fixed-height tab container: `CompanyFormDialog` reuses its existing `h-[620px] overflow-y-auto`; `ContactFormDialog` (currently tab-less) gets a new fixed height sized to its tallest tab, capped at 620px.
- No hardcoded UI strings — new keys in `en.json`, read via `t()`.
- No new npm dependency — diagram is hand-built SVG/CSS using `var(--color-crm-primary)` / neutral grey only (no hex, no blue).
- Update `api-endpoint-registry.md` in the same change.
- Deep debug logging (entry/branch/result + try/catch-rethrow) on the new controller and service methods.

**Ask First:** None outstanding — full design already approved by the user via the architect handoff. One correction was made during implementation planning without re-asking (see Design Notes): the architect's design assumed `RelationshipType` has an `isActive` flag; it doesn't.

**Never:**
- Don't retrofit i18n onto `CompanyFormDialog`/`ContactFormDialog`'s pre-existing tabs — out of scope, tracked separately.
- Don't model company-to-company or company-to-contact relationship edges — this is strictly party→RelationshipType tagging, same as the existing feature.
- Don't change `RelationshipViewWidget.tsx`'s existing per-type list behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add new tag | Company X, pick a type Y it isn't tagged under | New map row created, diagram gets a new spoke | N/A |
| Duplicate active tag | Company X already actively tagged under Y | 409 Conflict, no row created | UI shows inline error, list unchanged |
| Re-add a disabled tag | Company X has an inactive row for Y | Existing row reactivated via `setActive(true)`, not a new row | Audit log records an update, not an insert |
| Type doesn't exist | `relationshipTypeId` not found or soft-deleted | 404 NotFoundException | UI shows inline error |
| No tags yet | Party has zero relationship-type tags | Diagram shows center node only, empty-state message under it | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/modules/relationship-types/relationship-parties.service.ts` -- add `findTagsForCompany`/`findTagsForContact`/`linkExistingCompanyToType`/`linkExistingContactToType`, next to existing `addCompany`/`setActive`
- `backend/src/modules/relationship-types/relationship-tags.controller.ts` (new) -- 4 routes, mirrors `relationship-parties.controller.ts`'s guard/logging pattern
- `backend/src/modules/relationship-types/dto/add-relationship-tag.dto.ts` (new) -- `{ relationshipTypeId: string }`, `@IsUUID()`
- `backend/src/modules/relationship-types/relationship-types.module.ts` -- register new controller (line ~33)
- `frontend/src/lib/api/relationship-parties.ts` -- 4 new client functions, same `apiFetch` pattern as existing ones
- `frontend/src/components/ui/RelationshipHubDiagram.tsx` (new) -- shared presentational hub-spoke SVG component
- `frontend/src/app/[tenant]/(dashboard)/relationships/[id]/_components/CompanyFormDialog.tsx` -- extend `TabId` (line 200) with `"relationships"`
- `frontend/src/app/[tenant]/(dashboard)/relationships/[id]/_components/ContactFormDialog.tsx` -- add tab scaffold (currently none), existing form becomes `"details"` tab, add `"relationships"` tab
- `frontend/src/locales/en.json` -- new `relationshipTags` key namespace
- `_bmad-output/2-current-work/api-endpoint-registry.md` -- 4 new rows under "Relationship Parties" section
- **Added in review loop 1** — `backend/src/modules/pickers/pickers.controller.ts` -- new `GET /pickers/relationship-types` route (gated on `RELATIONSHIP_*`, the actual consumer's permission), replacing the add-tag picker's reuse of the full admin `GET /relationship-types` (gated on `RELATIONSHIP_TYPE_*`, a different resource's permission)
- **Added in review loop 1** — `common/src/contracts/pickers.contracts.ts` -- new `RelationshipTypePickerResponse { id, name }`
- **Added in review loop 1** — `frontend/src/lib/api/pickers.ts` -- new `listRelationshipTypesPicker()`
- **Added in review loop 1** — `backend/src/database/migrations/1784700000028-AddRelationshipCompanyContactMapUniqueIndexes.ts` (new) -- partial unique indexes on `(relationship_type_id, company_id)` / `(relationship_type_id, contact_id)`, closing the check-then-act race window

## Tasks & Acceptance

**Execution:**
- [x] `relationship-parties.service.ts` -- add the 4 methods above -- reuses existing repos/audit pattern, no new dependencies
- [x] `add-relationship-tag.dto.ts` -- new DTO -- validated request body for both POST routes
- [x] `relationship-tags.controller.ts` -- new controller, 4 routes -- exposes cross-type tag list/add, gated on existing `RELATIONSHIP_*` permissions
- [x] `relationship-types.module.ts` -- register controller -- wires it into Nest DI
- [x] `relationship-parties.ts` (frontend api) -- 4 new functions -- typed client calls for the above
- [x] `RelationshipHubDiagram.tsx` -- new shared component -- generic `{centerLabel, spokes}` renderer, no business logic
- [x] `CompanyFormDialog.tsx` -- add relationships tab (view: diagram, edit: add-tag picker) -- reuses fixed `h-[620px]` container
- [x] `ContactFormDialog.tsx` -- add tab scaffold + relationships tab -- first tabbed version of this dialog
- [x] `en.json` -- new `relationshipTags` strings -- tab label, empty state, add-picker label, conflict error
- [x] `api-endpoint-registry.md` -- document the 4 new endpoints -- keeps registry accurate per standing rule
- [x] `pickers.controller.ts` -- new `GET /pickers/relationship-types` route -- fixes bad_spec finding (see Spec Change Log)
- [x] `pickers.contracts.ts` -- new `RelationshipTypePickerResponse` -- backs the picker route above
- [x] `pickers.ts` (frontend) -- new `listRelationshipTypesPicker()` -- typed client call for the above
- [x] `CompanyFormDialog.tsx`/`ContactFormDialog.tsx` -- switch add-tag picker to `listRelationshipTypesPicker()`, surface its fetch failure instead of swallowing it -- consumes the fixed picker; error visibility patch
- [x] `1784700000028-AddRelationshipCompanyContactMapUniqueIndexes.ts` (new migration) -- partial unique indexes -- patch: closes the concurrent-duplicate-tag race
- [x] `relationship-parties.service.ts` -- catch Postgres `23505` in `linkExisting*ToType` → `ConflictException`; wrap full method bodies in try/catch; add `"relationshipType"` to `findOneOrFail`'s relations -- patches: race-condition 409, deep-logging gap, empty `relationshipTypeName` in POST response
- [x] `CompanyFormDialog.tsx`/`ContactFormDialog.tsx` -- move `tagError` render outside the `canCreate`-gated block -- patch: view-mode/no-permission fetch failures no longer look like "no tags"
- [x] `ContactFormDialog.tsx` -- harden `showRelationshipsTab` to also require `!contact.companyId`; conditional `maxWidth`; remove now-dead `companyOwnedNote` i18n key -- patches: defense-in-depth guard, cosmetic width fix
- [x] `RelationshipHubDiagram.tsx` -- add `title={centerLabel}` -- patch: truncated center label had no way to read the full value
- [x] `relationship-parties.service.ts` -- revert `findOneOrFail`'s relations widening; attach `relationshipType` manually in both `linkExisting*ToType` methods -- loop 2 patch: closes the widened `setActive`-relations-save risk flagged in review
- [x] `1784700000028-...ts` -- add `AND "deleted_at" IS NULL` to both unique indexes -- loop 2 patch: index now agrees with the service layer's own soft-delete-aware lookup
- [x] `CompanyFormDialog.tsx`/`ContactFormDialog.tsx` -- filter `taggedTypeIds` to active tags only -- loop 2 patch: makes the reactivation flow actually reachable from the UI
- [x] `ContactFormDialog.tsx`/`en.json` -- `t("relationshipTags.detailsTabLabel")` replacing hardcoded `"Person Details"` -- loop 2 patch: new code, no i18n exemption
- [x] `relationship-parties.service.ts` -- catch Postgres `23503` → `NotFoundException` in both `linkExisting*ToType` methods -- loop 2 patch: concurrent-delete edge case

**Acceptance Criteria:**
- Given a company tagged under 2 relationship types, when its dialog's Relationships tab opens in view mode, then a hub diagram renders the company as center with 2 correctly-labeled connected spokes.
- Given edit mode on that tab, when the user picks an untagged active relationship type and confirms, then a new tag is created, the diagram refreshes with the new spoke, and one `audit_logs` insert row exists for it.
- Given the company is already actively tagged under a type, when adding that same type again, then the API returns 409 and the UI surfaces the error without creating a duplicate row.
- Given `ContactFormDialog` previously had no tabs, when opened after this change, then its existing contact create/edit behavior is unchanged under the new "details" tab (no regression).

## Spec Change Log

**Loop 1 (2026-07-31) — bad_spec finding from adversarial review (Blind Hunter + Edge Case Hunter):**

- **Finding:** The add-tag picker (both dialogs) sourced its relationship-type options from `listRelationshipTypes()` → the full admin `GET /relationship-types` endpoint, gated on `RELATIONSHIP_TYPE_VIEW/CREATE/UPDATE/DELETE`. The Relationships tab itself is gated on `RELATIONSHIP_CREATE` (a different resource's permission set). A user holding `RELATIONSHIP_CREATE` but no `RELATIONSHIP_TYPE_*` permission would 403 on that fetch — silently, since the failure was swallowed by an empty `.catch()` with a "non-fatal, picker just stays empty" comment. This directly violates CLAUDE.md's explicit "RBAC Routes vs. System-Internal (Picker) Routes" rule: a picker consumed by users without the looked-up resource's own admin rights must be gated on the *consumer's* permission, via a system-internal route — never the resource's own full RBAC listing.
- **What was amended:** The original Code Map/Tasks under-specified how the add-tag picker should source its options — it left "reuse the existing types list" as an implicit, unstated implementation choice, when the codebase already has an established, explicit pattern for exactly this (the consolidated `PickersController` at `/pickers`, e.g. `GET /pickers/departments`). Added a proper `GET /pickers/relationship-types` route (gated on `RELATIONSHIP_*`), a `RelationshipTypePickerResponse` contract, and a frontend `listRelationshipTypesPicker()` client function to the Code Map and Tasks. Both dialogs now consume this instead of the admin endpoint.
- **Known-bad state avoided:** A `RELATIONSHIP_CREATE`-only role (plausible — tagging companies/contacts doesn't imply admin rights over the Relationship Types list itself) opening the Relationships tab in edit mode would see the "Add relationship type" control render normally, then find it permanently empty with no error, no matter how many untagged types exist. Indistinguishable from "everything is already tagged."
- **KEEP:** Everything else from the original implementation — the tab UI structure and fixed-height containers, `RelationshipHubDiagram`, the reactivation-vs-insert branch in `linkExisting*ToType`, the company-owned-contact guard, the `canCreate` threading through `RelationshipViewWidget.tsx` — was correct and is unchanged by this loop.

**Patches applied in the same pass** (survive independently of the bad_spec loopback, per the triage rules): a DB-level race-condition fix (new migration + Postgres `23505` catch) for the check-then-act duplicate-tag window; `findOneOrFail`'s relations now include `relationshipType` (POST responses previously always returned an empty `relationshipTypeName`); the two `linkExisting*ToType` methods now wrap their full bodies in try/catch (previously the early `NotFoundException` paths bypassed the method's own error logging); `tagError` now renders regardless of `canCreate`/view-mode (previously a failed tag-list fetch was indistinguishable from "no tags" outside edit mode); `ContactFormDialog`'s tab-visibility guard now also checks `contact.companyId` directly as defense in depth, and its `maxWidth` is conditional on the tab actually showing; `RelationshipHubDiagram`'s center node got a `title` attribute for long labels.

**Deferred, not fixed in loop 1** (see `deferred-work.md`): `setActive()`'s pre-existing relations-loaded-then-saved pattern (not introduced by this feature); the diagram's fixed layout not scaling past a handful of tags; the diagram's lack of screen-reader support for individual spokes.

**Loop 2 (2026-07-31) — patch findings only, no further spec amendment needed** (a second adversarial pass ran against the loop-1 diff; no bad_spec/intent_gap this time, all real findings were mechanically fixable):

- **`findOneOrFail`'s loop-1 relations widening reverted.** The comment justifying adding `"relationshipType"` to `findOneOrFail`'s relations (to fix the empty `relationshipTypeName` in POST responses) claimed every caller only reads it for display — false: `setActive()` is an existing, unchanged caller that *does* `saveScoped()` the object `findOneOrFail` returns, and `relationshipTypeId` is a `NOT NULL` column, unlike the nullable `companyId`/`contactId` already at risk there. Reverted the relations addition entirely; `linkExistingCompanyToType`/`linkExistingContactToType` now attach `relationshipType` manually from the `RelationshipType` object they already fetch for validation at the top of each method (zero extra queries, and the "new row" branch no longer needs its trailing `findOneOrFail` re-fetch at all — `saved` plus the manually-attached relation is already sufficient for the response).
- **Migration `1784700000028`'s unique indexes made soft-delete aware.** The original `WHERE "company_id" IS NOT NULL` (and contact equivalent) didn't exclude soft-deleted rows, while the service layer's own existing-row lookup does (`findOneScoped` auto-filters `deletedAt IS NULL`) — the two would disagree the moment a tag row was ever soft-deleted, permanently 409-blocking a legitimate re-tag. Added `AND "deleted_at" IS NULL` to both indexes, mirroring `1784700000029-MakeUsersUsernameIndexSoftDeleteAware.ts`'s identical fix for the same bug class. Not yet applied to any real database (written and corrected in the same session), so edited in place rather than issuing a follow-up migration.
- **Reactivation was unreachable from the UI — fixed.** `taggedTypeIds` in both dialogs was built from *all* tags (active and inactive), so once a tag was disabled its relationship type could never be reselected in the "Add relationship type" picker — the backend's entire reactivate-via-`setActive` branch (with its detailed audit-shape comments) had no way to be triggered from this tab. Filtered `taggedTypeIds` to active tags only in both dialogs.
- **New hardcoded string fixed.** `ContactFormDialog.tsx`'s new tab bar (this dialog had no tabs before this feature) had one button correctly using `t()` and its sibling hardcoding literal `"Person Details"` JSX text. Added `relationshipTags.detailsTabLabel` to `en.json`, both buttons now go through `t()`.
- **Added a `23503` (FK violation) catch alongside the existing `23505` catch** in both `linkExisting*ToType` methods — a company/contact deleted by a concurrent request between the existence check and the insert now surfaces as a clean 404 instead of an unmapped raw 500.
- **Deferred, not fixed in loop 2** (see `deferred-work.md`): non-409 tag errors displaying the raw backend message instead of routing through `t()` (matches this codebase's existing `ApiError`-handling convention elsewhere, not a regression specific to this diff); the add-tag picker's option list not refreshing after mount; `tagError` being shared between two independent fetch effects (a near-simultaneous double-failure could overwrite one message with the other).
- **Rejected as noise**: a migration-dedup-guard suggestion (the only rows that can exist for a `(type, company)` pair were created via `addCompany`, which always makes a brand-new company row, so no pre-existing duplicate-pair data can exist to break the migration); a duplicated `ANY_RELATIONSHIP_PERMISSION` constant across three controllers (already the codebase's pre-existing convention — `relationship-parties.controller.ts` already had its own copy before this feature); the `relationship-parties/` vs `relationship-types/:id/parties/` route-naming overlap (stylistic, no actual collision, already raised and rejected in loop 1); the audit-trail shape difference between a fresh tag and a reactivation (already an explicit, documented, approved trade-off from loop 1's Design Notes).

## Design Notes

The architect's design assumed `RelationshipType` has an `isActive` flag to check before allowing a new tag (mirroring the Selectable Scope pattern used elsewhere). Checked `relationship-type.entity.ts` directly: it has no such column, only inherited soft-delete (`deletedAt`) via `AuditedTenantEntity`. `relationshipTypesService.findOneOrFail()` already 404s on a missing/soft-deleted type via its tenant-scoped lookup, which is sufficient — the extra active-check step is dropped from `linkExisting*ToType`.

**Additional decisions made during implementation (all reviewed and approved by the coordinator before/while coding):**

1. **New endpoints key off the real Company/Contact id, not a per-type `mapId`.** `RelationshipPartiesController`'s existing routes are scoped to one relationship type. Showing a party's tags across every type it's tagged under is inherently cross-type, so it can't be keyed by a single-type `mapId`. New controller: `RelationshipTagsController` at `@Controller("relationship-parties")`, routes `GET/POST companies/:companyId/tags` and `GET/POST contacts/:contactId/tags`. This also naturally covers company-owned contacts (see #3) — they just resolve to an empty tag list via their own `contactId`, which is correct, not a gap.

2. **`findTagsForCompany`/`findTagsForContact` return BOTH active and inactive rows (no `isActive` filter).** `RelationshipTagResponse.isActive` is carried through specifically so `RelationshipHubDiagram` can render the distinction — active spoke: `bg-crm-primary`/primary-red line; inactive spoke: neutral grey (`var(--color-border)`/`var(--color-bg)`/`var(--color-text-muted)`), all via existing design tokens, no hardcoded hex. The create-vs-reactivate branch inside `linkExisting*ToType` does its own separate, unfiltered lookup regardless (it needs to find a disabled row to reactivate it).

3. **Company-owned contacts are guarded against getting an independent tag.** `addCompany`/`addContact` deliberately never give a company-owned contact its own `relationship_company_contact_map` row (the 2026-07-22 double-counting fix already documented in `relationship-parties.service.ts`). `linkExistingContactToType` throws `BadRequestException` if `contact.companyId` is set, so this feature can't reopen that bug. On the frontend, `ContactFormDialog`'s Relationships tab (and its whole tab bar) is hidden entirely when `companyContext` is set (editing a company-owned contact) — consistent with this spec's own Verification section, which calls out testing "a standalone Contact," not the company-owned case.

4. **Audit `entityType` for a brand-new tag insert is `"relationship_company_contact_map"`** (per the Boundaries rule, verbatim). Reactivating a disabled row reuses the existing, unmodified `setActive()` method (per the Code Map: "reuses ... `setActive`"), which logs `entityType: "relationship_party"` — its normal, pre-existing audit shape. This is a deliberate difference between insert and reactivate, not drift.

5. **The Relationships tab only renders once the party has a real id** — hidden in `mode === "create"` on both dialogs, mirroring `CompanyFormDialog`'s existing `mode !== "create"` gate on its "Existing contacts" section.

6. **`canCreate` threaded from `RelationshipViewWidget.tsx` into both dialogs**, the same way `canUpdate`/`canDelete` already are, to gate the add-tag picker/button's visibility for users without `RELATIONSHIP_CREATE`. `RelationshipViewWidget.tsx` was not in the spec's original Code Map but needed this small additive edit (two new `canCreate={canCreate}` props on its `edit-company`/`edit-contact` dialog instances) — no other logic there was touched.

## Suggested Review Order

**Entry point — the reactivate-vs-insert decision**

- Start here: the core business rule this feature adds — tag an existing party, or reactivate its disabled tag, with a DB constraint (not just app logic) backing the "no duplicates" promise.
  [`relationship-parties.service.ts:615`](../../backend/src/modules/relationship-types/relationship-parties.service.ts#L615)

- Same shape for a standalone Contact, plus the company-owned-contact guard.
  [`relationship-parties.service.ts:690`](../../backend/src/modules/relationship-types/relationship-parties.service.ts#L690)

**Data integrity — closing the concurrency window**

- The partial unique index backing the 409/reactivate logic above; soft-delete-aware so a re-tag after a soft-deleted row doesn't false-409.
  [`1784700000028-AddRelationshipCompanyContactMapUniqueIndexes.ts:20`](../../backend/src/database/migrations/1784700000028-AddRelationshipCompanyContactMapUniqueIndexes.ts#L20)

- Read-only display query, deliberately NOT loading `relationshipType` here — see its comment for why (a `saveScoped` caller elsewhere makes that risky).
  [`relationship-parties.service.ts:54`](../../backend/src/modules/relationship-types/relationship-parties.service.ts#L54)

**Cross-type read side**

- `findTagsForCompany`/`findTagsForContact` — returns active AND inactive tags on purpose; the diagram renders the distinction.
  [`relationship-parties.service.ts:553`](../../backend/src/modules/relationship-types/relationship-parties.service.ts#L553)

- New controller exposing the above, keyed by the real party id (not a per-type mapId) since tags span every type.
  [`relationship-tags.controller.ts:26`](../../backend/src/modules/relationship-types/relationship-tags.controller.ts#L26)

**The picker permission fix**

- New `/pickers/relationship-types` route — the reason a second endpoint exists at all: the add-tag dropdown needs a consumer-permission-gated lookup, not the admin CRUD list.
  [`pickers.controller.ts:250`](../../backend/src/modules/pickers/pickers.controller.ts#L250)

**Frontend — the Relationships tab**

- `taggedTypeIds` filters to active tags only — the one-line fix that makes reactivation reachable from this UI at all.
  [`CompanyFormDialog.tsx:603`](../../frontend/src/app/%5Btenant%5D/(dashboard)/relationships/%5Bid%5D/_components/CompanyFormDialog.tsx#L603)

- Same fix, plus `showRelationshipsTab`'s defense-in-depth guard against a company-owned contact.
  [`ContactFormDialog.tsx:103`](../../frontend/src/app/%5Btenant%5D/(dashboard)/relationships/%5Bid%5D/_components/ContactFormDialog.tsx#L103)

- `ContactFormDialog`'s first-ever tab bar — this dialog had none before this feature.
  [`ContactFormDialog.tsx:50`](../../frontend/src/app/%5Btenant%5D/(dashboard)/relationships/%5Bid%5D/_components/ContactFormDialog.tsx#L50)

**Shared component**

- Hand-built SVG hub-and-spoke — no new dependency; active/inactive styling comes entirely from design tokens.
  [`RelationshipHubDiagram.tsx:34`](../../frontend/src/components/ui/RelationshipHubDiagram.tsx#L34)

**Peripherals**

- New contract shapes both endpoints return.
  [`relationship-parties.contracts.ts`](../../common/src/contracts/relationship-parties.contracts.ts) · [`pickers.contracts.ts`](../../common/src/contracts/pickers.contracts.ts)

- New user-facing strings for this feature (all new UI text routes through here, including the loop-2 `detailsTabLabel` fix).
  [`en.json`](../../frontend/src/locales/en.json)

- Endpoint documentation kept in sync per the standing registry rule.
  [`api-endpoint-registry.md`](api-endpoint-registry.md)

## Verification

**Commands:**
- `cd backend && npm run build` -- expected: compiles clean
- `cd backend && npm run lint` -- expected: no new errors
- `cd frontend && npm run build` -- expected: compiles clean
- `cd frontend && npm run lint` -- expected: no new errors

**Manual checks (if no CLI):**
- Boot the app, open a Company under a Relationship Type page, confirm the new tab renders the diagram, add a new tag, confirm it appears; attempt a duplicate add, confirm the 409 surfaces cleanly. Repeat for a standalone Contact.
