# Roles / Permission Dialog Review

Part of the split bugs tracker — see [`../BUGS.md`](../BUGS.md) for the severity legend shared
across every file in this folder. Still open.

- 🟡 "Clear all" in `RolePermissionsDialog` clears every selected permission across *all* groups
  regardless of active filters, with no confirmation — inconsistent with the sibling role-delete
  action's confirm dialog.
- 🟡 `ConfirmDialog`/`AlertDialog` in `RolesTableWidget` can render simultaneously; a single Escape
  dismisses both with no distinct feedback.
- 🟡 `AccountMenu`'s Log out button uses an inline red style that both breaks the shared hover rule
  and gives a reversible action the same visual alarm as a destructive one.
- ⚪ `RoleFormDialog`'s "Name *" required marker is cosmetic only — no `required`/`aria-required` on
  the input (same gap in `TenantFormDialog`).
- ⚪ `.permissions-*` CSS hardcodes literal hex colors instead of the `--color-*` tokens used
  elsewhere.
- ⚪ The search input and "Level" filter select in `RolePermissionsDialog` have no accessible label.
- ⚪ Resource name prefix-stripping (`name.replace(\`${prefix}:\`, '')`) assumes exactly one
  occurrence — silently no-ops for a name without a colon.
- ⚪ `.permissions-grid` is a hardcoded two-column layout with no responsive breakpoint.
