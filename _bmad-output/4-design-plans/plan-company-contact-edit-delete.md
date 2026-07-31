# Edit/Delete company-owned contacts from CompanyFormDialog's Contacts tab

## Context

`CompanyFormDialog.tsx`'s "Existing contacts" block (lines 734-763) displays contacts already
saved under a company as disabled, read-only fields, with UI copy stating outright: "Editing or
removing an existing contact isn't available here yet." This is display-only by design, not a
permission gap — confirmed separately that RELATIONSHIP_UPDATE/RELATIONSHIP_DELETE (which every
Super Admin holds) is structurally insufficient here, because **no backend capability exists at
all** to update or delete a company-owned contact. Every existing contact-mutation route
(`PATCH .../parties/contacts/:mapId`, `DELETE .../parties/:mapId`) is keyed by
`relationship_company_contact_map.id` — and a company-owned contact deliberately has no such row
(the 2026-07-22 fix that stopped double-counting them as independent relationship parties). This
plan adds the missing capability, scoped tightly to this one dialog's Contacts tab — not the
broader "standalone contact visibility" gap raised earlier, which stays out of scope.

## Design

### 1. Backend — new routes on the existing `RelationshipPartiesController`
No new module/wiring needed — `RelationshipTypesModule` already has `Contact` registered via
`TypeOrmModule.forFeature` and `ContactsRepository` already injected into
`RelationshipPartiesService`. Add two routes, siblings to the existing
`GET companies/:mapId/contacts` (`listCompanyContacts`):

- `PATCH relationship-types/:relationshipTypeId/parties/companies/:mapId/contacts/:contactId` —
  gated `RELATIONSHIP_UPDATE`, body `UpdateRelationshipPartyContactDto` (already has the right
  fields, no map-id coupling — reuse as-is).
- `DELETE relationship-types/:relationshipTypeId/parties/companies/:mapId/contacts/:contactId` —
  gated `RELATIONSHIP_DELETE`.

### 2. Backend — new service methods on `RelationshipPartiesService`
Sibling to `listContactsForCompany` (lines 184-197), same defensive pattern: resolve
`mapId → party.companyId` via `findOneOrFail`, throw `BadRequestException` if not a company party,
then scope the `Contact` lookup to `{ id: contactId, companyId: party.companyId }` — this proves
the contact actually belongs to *this* company before touching it (prevents editing/deleting a
contact via the wrong company's mapId).

- `updateContactForCompany(relationshipTypeId, mapId, contactId, dto, userId)`: `Object.assign` +
  `saveScoped` (same pattern already proven in the existing `updateContact` method, lines
  267-280), re-fetch, audit-log diff via `AuditLogService.record({ entityType: "contact", action:
  "update", ... })` — `"contact"` as `entityType` matches the existing convention noted in
  CLAUDE.md's audit rollout ("a proper audit-entity split: company/contact for field changes").
  Standard debug-log entry/branch/result + try/catch-rethrow throughout.
- `removeContactForCompany(relationshipTypeId, mapId, contactId, userId)`: soft-delete via a new
  `ContactsRepository.softRemoveScoped(contact, actorId)` method (does not exist yet — add it,
  mirroring `RelationshipPartiesRepository.softRemoveScoped` exactly: tenant check, `repo.softRemove`,
  `repo.update(id, { deletedBy })`). Audit-log `action: "delete"`. No cascade concern — contacts
  aren't a parent of any other soft-deletable table in this schema, so the plain `useConfirm()`
  dialog is correct on the frontend, not the cascade-delete-confirm variant.

### 3. Frontend — new API client functions
`frontend/src/lib/api/relationship-parties.ts`: add
`updateCompanyContact(relationshipTypeId, mapId, contactId, payload)` (PATCH) and
`deleteCompanyContact(relationshipTypeId, mapId, contactId)` (DELETE), same `apiFetch` shape as
every sibling function already in this file.

### 4. Frontend — `ContactFormDialog.tsx`
Cannot be reused unmodified — its edit-mode submit handler hardcodes `updateRelationshipPartyContact(relationshipTypeId, mapId!, ...)`, and it's never been opened from `CompanyFormDialog.tsx` before (that file builds its own inline "add contact" fields directly, not via this dialog) — so this is a clean new integration point, not a change to an established call site's behavior. Add one new optional prop:

```ts
companyContext?: { companyMapId: string; contactId: string };
```

Submit handler branches three ways: `create` (unchanged) → `companyContext` present → call the
new `updateCompanyContact(relationshipTypeId, companyContext.companyMapId, companyContext.contactId, {...})`
→ else (existing standalone-party edit path, unchanged) → `updateRelationshipPartyContact(...)`.
When `companyContext` is set, hide the "Company" picker field (lines 148-160) — the contact's
company is fixed in this context, and re-pointing it to a different company is a separate concern
not in scope here.

### 5. Frontend — `CompanyFormDialog.tsx`'s existing-contacts block (lines 734-763)
Replace the disabled-fields-only rendering with:
- Per-row `EditIcon`/`TrashIcon` buttons (same `icon-btn`/`icon-btn-danger` classes used
  throughout the app, e.g. `SubStagesWidget.tsx`'s row actions), gated on `canUpdate`/`canDelete`.
  Confirmed: `CompanyFormDialog.tsx` currently takes zero permission props (it performs no
  client-side permission check of its own today — `RelationshipViewWidget.tsx` only gates whether
  the dialog opens at all, via its own `canUpdate`/`canDelete` derived from
  `RELATIONSHIP_UPDATE`/`RELATIONSHIP_DELETE`). Add a `canUpdate`/`canDelete` prop pair to
  `CompanyFormDialogProps`, threaded from `RelationshipViewWidget.tsx`'s existing values at its
  `<CompanyFormDialog>` call site(s).
- Edit opens `ContactFormDialog` in `mode="edit"` with `companyContext={{ companyMapId: mapId, contactId: existing.id }}` and `contact={existing}`.
- Delete calls `useConfirm()` (existing hook, same pattern as every other simple delete in this
  app), then `deleteCompanyContact(...)`, then removes the row from local `existingContacts`
  state (tab count at line 471 updates automatically since it's derived from
  `contacts.length + existingContacts.length`).
- Remove the now-inaccurate "isn't available here yet" copy (lines 757-760).

## Verification
1. Backend typecheck clean, zero new errors beyond the pre-existing baseline.
2. `curl` through the real API: create a company with an inline contact, PATCH the contact's
   name via the new route, confirm it persists and an `audit_logs` "update" row lands with
   `entityType: "contact"`; DELETE it, confirm `deleted_at`/`deleted_by` set on the `contacts` row
   and the contact no longer appears in `listCompanyContacts`.
3. Cross-company guard: attempt the same PATCH/DELETE using a *different* company's `mapId` paired
   with the first company's real `contactId` — confirm it's rejected (404/400), not silently
   successful, proving the `companyId` scoping actually protects against cross-company tampering.
4. Frontend typecheck clean. Visual pass: open a company with existing contacts, edit one's name,
   confirm it saves and re-renders; delete one, confirm the confirm-dialog appears and the row
   disappears; confirm the Contacts tab count updates correctly in both cases.
