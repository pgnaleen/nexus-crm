# Add read-only View mode to the Relationships table

## Context

`RelationshipViewWidget.tsx`'s main table row (`onClick={canUpdate ? () => openEdit(party) : undefined}`)
has two bugs: (1) anyone who can update lands straight in a live Edit form on a stray row click,
with no read-only inspection step first; (2) anyone who can only *view* (holds `RELATIONSHIP_VIEW`
but not `RELATIONSHIP_UPDATE`) gets a dead click — no dialog opens at all, since there's no
fallback branch. Neither `CompanyFormDialog.tsx` nor `ContactFormDialog.tsx` has a "view" mode to
fall back to in the first place (`mode: "create" | "edit"` only).

Agreed fix (confirmed against the two places in this codebase where this genuinely works today —
`RolesTableWidget.tsx`/`TenantsTableWidget.tsx`, both of which already share Relationships'
separate-action-icons-in-a-column structure): **row click always opens read-only View if
`canView`; the existing pencil icon in the actions column opens Edit if `canUpdate`.** This is
safer (no accidental edits from a stray click) and requires no ternary fallback logic.

## Design

### 1. Two small shared-component additions (needed for the read-only fields)
- `frontend/src/components/ui/CustomSelect.tsx`: add `disabled?: boolean` — skip the `onClick`
  that opens the dropdown when disabled, dim it visually (matches how every other form control in
  this app signals disabled). Currently has zero disabled support; every existing caller passes no
  `disabled` prop today, so this is purely additive — no existing behavior changes.
- `frontend/src/components/ui/PhoneField.tsx`: **no change needed** — its props already extend
  `InputHTMLAttributes<HTMLInputElement>` (which includes `disabled`) and spread `...inputProps`
  straight onto the underlying `react-phone-number-input` component, which already supports
  `disabled` natively.

### 2. `ContactFields.tsx` (shared by `ContactFormDialog` and `CompanyFormDialog`'s inline add-contact rows)
Add `disabled?: boolean` to `ContactFieldsProps`, thread it to every field: `TextField`s already
support it, `CustomSelect` (Buying role) will after step 1, `PhoneField`/`CountrySelect` already do.

### 3. `ContactFormDialog.tsx`
- `mode: "create" | "edit" | "view"`; `const isViewOnly = mode === "view";` (exact
  `DepartmentFormDialog.tsx` convention — the established reference pattern in this codebase).
- Dialog title: third branch for `"view"` (e.g. `"View Person"`).
- `<ContactFields disabled={isViewOnly} .../>`.
- The standalone Company picker (only rendered when `!companyContext`, i.e. viewing a standalone
  party, not a company-owned contact) gets `disabled={isViewOnly}` on its `CustomSelect`.
- Footer: `{isViewOnly ? "Close" : "Cancel"}`; wrap the Save `<Button type="submit">` in
  `{!isViewOnly && (...)}`.

### 4. `CompanyFormDialog.tsx`
- Same `mode`/`isViewOnly`/title/footer treatment as above, across all three tabs.
- Every field (`TextField`s, `CustomSelect`s for AccountTier/EmployeeCountBand/RevenueBand/Sector/
  FiscalYearEndMonth/Region/CreditStatus, `CountrySelect`, the territory-notes `textarea`) gets
  `disabled={isViewOnly}`.
- Logo upload button/file input: hidden or disabled when `isViewOnly` — no upload action makes
  sense in a read-only dialog.
- The "add a new contact" rows + "Add contact" button (the *new*-contact-drafting UI, distinct
  from the "Existing contacts" list) are wrapped in `{!isViewOnly && (...)}` — adding new data has
  no place in a View dialog.
- **"Existing contacts" edit/delete buttons** (added earlier this session, gated on `canUpdate`/
  `canDelete` props): add an explicit `{!isViewOnly && (canUpdate || canDelete) && (...)}` guard
  around the whole action-buttons block, rather than relying solely on the props happening to be
  false. This matters because `canDelete`/`canUpdate` are independent permissions — a user could
  hold `RELATIONSHIP_DELETE` without `RELATIONSHIP_UPDATE`, land in `view-company` (gated on
  `canView`, unrelated to `canDelete`), and would otherwise still see a live Delete-contact button
  inside a dialog labeled "View." `isViewOnly` becomes the single authoritative switch for all
  mutating UI in this dialog, matching `DepartmentFormDialog`/`SubStageFormDialog`'s convention.
  (The props themselves don't need to change at the call site — still pass real `canUpdate`/
  `canDelete` through unconditionally, exactly as `edit-company` already does; the dialog's own
  `isViewOnly` check is the safety net regardless of what's passed in.)

### 5. `RelationshipViewWidget.tsx`
- `DialogState` gains two variants: `{ mode: "view-company"; party: RelationshipPartyResponse }`
  and `{ mode: "view-contact"; party: RelationshipPartyResponse }`.
- New `openView(party)` function, mirroring `openEdit`'s exact `party.kind === "company"` branch
  (lines 146-148) but setting `"view-company"`/`"view-contact"`.
- Row `onClick` changes from `canUpdate ? () => openEdit(party) : undefined` to
  `canView ? () => openView(party) : undefined` — matches `RolesTableWidget`/`TenantsTableWidget`
  exactly. Row cursor/hover className condition changes from `canUpdate` to `canView` to match.
  The existing pencil-icon Edit button in the actions column (already `canUpdate &&`, calls
  `openEdit(party)`, `stopPropagation`) is untouched — still the only way to reach Edit.
- Two new render blocks, siblings to the existing `edit-company`/`edit-contact` ones:
  `dialogState?.mode === "view-company"` → `<CompanyFormDialog mode="view" ... canUpdate={canUpdate} canDelete={canDelete} />`;
  `dialogState?.mode === "view-contact"` → `<ContactFormDialog mode="view" ... />`.

## Verification
1. Frontend typecheck clean, zero new errors beyond the pre-existing baseline.
2. Visual pass as a user holding only `RELATIONSHIP_VIEW`: clicking a Company row opens a read-only
   View dialog (every field disabled, only a Close button, no Existing-contacts edit/delete
   buttons, no add-contact section) — previously this was a dead click. Same for a Contact row.
3. Visual pass as a user holding `RELATIONSHIP_VIEW` + `RELATIONSHIP_UPDATE`: row click opens View
   (not Edit); the pencil icon in the actions column still opens the real Edit dialog.
4. Visual pass as a user holding `RELATIONSHIP_DELETE` but not `RELATIONSHIP_UPDATE`: confirm the
   View dialog's Existing-contacts list shows no Delete button either (the explicit `isViewOnly`
   guard, not just `canDelete`, is what's actually hiding it).
5. Confirm renaming/tab-switching inside the View dialog still works (tabs are just navigation,
   unaffected by disabled fields) and that closing returns cleanly to the table with no stray state.
