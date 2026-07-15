---
title: 'Risk-level filter in Roles permission assignment dialog'
type: 'feature'
created: '2026-07-15'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# Risk-level filter in Roles permission assignment dialog

## Intent

**Problem:** When assigning permissions to a role in `RolePermissionsDialog`, admins could only filter the resource list by search text and platform/tenant level — there was no way to filter by how risky a permission is (`rbac_resources.risk_level`), even though the field was already returned by the API.

**Approach:** Added a second filter `<select>` (Low/Medium/High/Critical) next to the existing level filter, combined it into the dialog's existing `filteredResources` memo, and added a color-coded risk badge to each permission row so the filter's effect is visible.

## Suggested Review Order

**Filter logic**

- Entry point — new filter state and its slot in the existing filter pipeline.
  [`RolePermissionsDialog.tsx:122`](../../frontend/src/components/widgets/RolePermissionsDialog.tsx#L122)

- Risk-level type and display labels derived from the shared `RbacRiskLevel` enum.
  [`RolePermissionsDialog.tsx:33`](../../frontend/src/components/widgets/RolePermissionsDialog.tsx#L33)

**UI binding**

- Risk filter `<select>`, given its own `aria-label` and a shared (renamed) select class.
  [`RolePermissionsDialog.tsx:160`](../../frontend/src/components/widgets/RolePermissionsDialog.tsx#L160)

- Per-row risk badge, colored via a CSS modifier class keyed off `resource.riskLevel`.
  [`RolePermissionsDialog.tsx:222`](../../frontend/src/components/widgets/RolePermissionsDialog.tsx#L222)

**Styling**

- Shared select class renamed from `.permissions-level-select` to `.permissions-filter-select` (now used by both filters, not just one).
  [`globals.css:1518`](../../frontend/src/app/globals.css#L1518)

- Risk badge base class with a neutral fallback, plus one color pair per risk level.
  [`globals.css:1624`](../../frontend/src/app/globals.css#L1624)
