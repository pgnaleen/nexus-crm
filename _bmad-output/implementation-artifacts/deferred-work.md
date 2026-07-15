# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: RolePermissionsDialog's "Clear all" button clears every selected permission across all groups regardless of active search/level/risk filters, with no confirmation step.
  evidence: A user who filters to one group and clicks Clear all silently loses all other groups' selections too; the sibling role-delete action was just upgraded to a confirmed dialog for a less destructive action, so the safety bar is inconsistent within the same feature.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: ConfirmDialog and AlertDialog in RolesTableWidget can render simultaneously and both close on a single Escape keypress.
  evidence: Nothing prevents opening a new delete-confirmation while a prior delete's error alert is still shown; a single Escape dismisses both with no distinct feedback for which was intended.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: AccountMenu's Log out button uses an inline red style that both breaks the shared hover rule and gives a reversible action the same visual alarm as destructive ones.
  evidence: ".account-menu-item:hover"'s background never shows because the inline style wins, and solid red desensitizes users to the red=danger convention used for actual destructive actions elsewhere.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: RoleFormDialog's "Name *" required marker is cosmetic only; the underlying input has no required/aria-required attribute.
  evidence: Assistive tech gets no indication the field is required; the same gap already exists in TenantFormDialog.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: The pre-existing .permissions-* CSS block hardcodes literal hex colors instead of the CSS variables (var(--color-border) etc.) used elsewhere in globals.css.
  evidence: Any future theme/color adjustment needs a special-cased hunt through this one block; new risk-tag colors followed the same pre-existing local convention rather than introducing a second inconsistency.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: The search input and "Level" filter select in RolePermissionsDialog have no accessible label (placeholder/visual only).
  evidence: A11y regression relative to the rest of the form-heavy codebase, which uses TextField's explicit label pattern; the new Risk select was given an aria-label but these two pre-existing controls were not, since they predate this change.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: Resource name prefix-stripping in RolePermissionsDialog (name.replace(`${prefix}:`, '')) assumes exactly one "prefix:rest" occurrence.
  evidence: A resource name without a colon, or where the prefix text recurs later in the string, silently displays the untouched full name with no test coverage for that path.

- source_spec: `_bmad-output/implementation-artifacts/spec-roles-permission-risk-level-filter.md`
  summary: .permissions-grid is a hardcoded two-column layout with no responsive breakpoint.
  evidence: On a narrower viewport, or if the dialog's maxWidth is ever reduced, groups will cramp instead of reflowing to one column.
