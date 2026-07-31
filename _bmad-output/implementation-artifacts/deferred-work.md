# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-relationship-tags-tab.md`
  summary: "`RelationshipPartiesService.setActive()` saves an entity loaded with relations (`company`, `company.territoryOwner`, `contact`) -- the same anti-pattern CLAUDE.md's TypeORM Gotcha section documents as having nulled FK columns elsewhere (the Deals bug)."
  evidence: "`setActive()` (`relationship-parties.service.ts` ~L505) calls `findOneOrFail` (which eagerly loads those relations) then mutates `isActive`/`updatedBy` and `saveScoped()`s the same object. Pre-existing -- already the code path behind the existing enable/disable endpoints (verified live per `api-endpoint-registry.md`'s row 9 note, with no observed corruption), not introduced by the Relationship Tags Tab feature. A 2nd review pass caught that this feature's own loop-1 fix had made it worse (widened `findOneOrFail`'s relations to also include `relationshipType`, a NOT NULL column, specifically to reach `setActive` through the new reactivation branch) and that the code comment claiming 'never save()s it' was factually wrong given `setActive` is a real, unchanged caller. **Fixed in loop 2**: reverted the relations widening entirely -- `linkExistingCompanyToType`/`linkExistingContactToType` now attach `relationshipType` manually from an object already fetched earlier in the same method, so nothing about this feature adds risk to `setActive` anymore. The underlying pre-existing pattern in `setActive` itself is unchanged and still deferred here -- worth a focused audit of whether `RelationshipCompanyContactMap`'s specific relation config actually triggers the FK-nulling behavior, and, if so, splitting `setActive` into a bare-load-then-save per the documented TypeORM rule (same fix already applied to `deals.service.ts`)."

- source_spec: `_bmad-output/implementation-artifacts/spec-relationship-tags-tab.md`
  summary: "`RelationshipHubDiagram`'s hub-and-spoke layout has a fixed radius/node size and doesn't reflow for a party tagged under many relationship types."
  evidence: "`RelationshipHubDiagram.tsx` -- `RADIUS`/`SPOKE_NODE_WIDTH`/`SPOKE_NODE_HEIGHT` are constants regardless of `spokes.length`; a company tagged under 6+ types will show visibly overlapping spoke nodes on the fixed 420x260 viewBox. Accepted for v1 since relationship types are an admin-curated reference list, typically small (per the architect's original design framing); revisit if tenants end up with many types in practice."

- source_spec: `_bmad-output/implementation-artifacts/spec-relationship-tags-tab.md`
  summary: "`handleAddTag`'s catch block in both dialogs only routes the 409 case through `t()`; every other `ApiError` (404, 400 company-owned-contact, etc.) displays the raw backend English message verbatim."
  evidence: "`CompanyFormDialog.tsx`/`ContactFormDialog.tsx` `handleAddTag`: `setTagError(err.status === 409 ? t(...) : err.message)`. Not a new pattern introduced by this feature -- matches this codebase's existing convention for `ApiError` messages elsewhere (e.g. `ContactFormDialog`'s own pre-existing `formError` handling does the same thing), so not treated as a regression specific to this diff. Worth a codebase-wide pass on whether backend error messages should route through i18n at all, separate from this feature."

- source_spec: `_bmad-output/implementation-artifacts/spec-relationship-tags-tab.md`
  summary: "The add-tag picker's relationship-type options are fetched once on dialog mount and never refreshed, so a type created/renamed/removed by another user while the dialog stays open won't appear until it's reopened."
  evidence: "`CompanyFormDialog.tsx`/`ContactFormDialog.tsx`'s `relationshipTypeOptions` effect runs once per `[mode, canCreate]` (or `showRelationshipsTab`); `handleAddTag`'s success path only calls `refreshTags()` (the party's own tag list), never re-fetches the picker options. Low-probability window (another admin editing Relationship Types during the exact time this dialog is open) with a low-severity outcome (stale dropdown, not incorrect data)."

- source_spec: `_bmad-output/implementation-artifacts/spec-relationship-tags-tab.md`
  summary: "The tag-list fetch and the relationship-type-picker fetch share one `tagError` state; if both fail in the same render window, whichever settles last silently overwrites the other's message."
  evidence: "`CompanyFormDialog.tsx`/`ContactFormDialog.tsx` both write to the same `setTagError` from two independent `useEffect`s. Requires both fetches to fail near-simultaneously to manifest; worst case is a missing/wrong error message shown, not data loss."

- source_spec: `_bmad-output/implementation-artifacts/spec-relationship-tags-tab.md`
  summary: "`RelationshipHubDiagram` is not accessible to screen readers -- only the center label reaches assistive tech."
  evidence: "The whole SVG collapses to `role=\"img\" aria-label={centerLabel}`; individual relationship-type names and their active/inactive state (conveyed purely by stroke/fill color) never reach a screen reader. No documented project accessibility standard was violated (unlike the RBAC-vs-picker rule, which is explicit in CLAUDE.md), so this wasn't treated as blocking, but it's a real gap for a feature that's otherwise fully keyboard/permission-correct."


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

- source: commit `9fd864f` ("fix: funnel board column matching, deal stage visibility, and UI encoding") — code review, 2026-07-20
  summary: "[HIGH] `deals.service.ts` create()/update() accept client-supplied companyId/ownerId/contactId/sourceId/mainStageId/currentStageId with no tenant ownership check."
  evidence: "`backend/src/modules/deals/deals.service.ts` (create ~L24-36, update ~L38-46) passes these straight into createScoped/Object.assign. DB FKs reference bare PKs, not (tenant_id, id), so a tenant-A user who knows/guesses a tenant-B UUID can link a deal to it; findAllWithRelations/findOneWithRelations then leak that other tenant's company/owner name back in the API response."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[HIGH] `deal-contacts.service.ts` add() never validates contactId belongs to the caller's tenant."
  evidence: "`backend/src/modules/deals/deal-contacts.service.ts` L19-35 only checks for a duplicate mapping, not tenant ownership. A caller supplying another tenant's contact UUID links it successfully, and findAll() then returns that tenant's contact name/title/email."
  resolved: "2026-07-20, commit `01fb6ab` — deal-contacts.service.ts/controller.ts were replaced by deal-partners.service.ts/controller.ts (generalizing the concept to company-or-contact deal partners). The new addCompany()/addContact() both resolve the target through CompaniesRepository/ContactsRepository's tenant-scoped findOneScoped() before linking, with an explicit comment noting this closes exactly this gap. Verified during pre-deploy review."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[HIGH] Logo upload lets the stored file extension diverge from the validated MIME type, enabling stored XSS."
  evidence: "`backend/src/modules/uploads/uploads.controller.ts` L49-52 takes the extension from client-supplied `originalname`, independent of the (also spoofable) `fileFilter` MIME check. Uploading e.g. `evil.html` with `Content-Type: image/png` passes validation, is stored as `<uuid>.html`, and is served by unauthenticated `express.static` (`backend/src/main.ts` L20) as live HTML — script executes in-origin with session cookies attached."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[HIGH] AddDealDialog can create duplicate deals when a post-create document upload or contact-link call fails."
  evidence: "`frontend/src/components/funnel/AddDealDialog.tsx` (~L294-329) shares one try/catch across createDeal() and the follow-up Promise.all of uploads/contact-links. If any of those fail after the deal is already persisted, onCreated/onClose never fire; the dialog stays open with the same values and resubmitting calls createDeal() again with identical fields."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[HIGH] CalendarWidget keys calendar-grid dates off UTC while \"today\" is computed from local time, misplacing reminders by a day."
  evidence: "`frontend/src/app/[tenant]/(dashboard)/calendar/_components/CalendarWidget.tsx`: isoDate()/dateStr() use `toISOString().split('T')[0]` (UTC) but todayStr uses local getFullYear/getMonth/getDate. For any user ahead of UTC (e.g. UTC+5:30, this org's own timezone) before ~05:30 local, every Month/Week/Year grid cell is off by one day — isToday and reminder placement land on the wrong cell."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] Deal code generation (`DEAL-00001` style) has a race condition and no DB uniqueness constraint."
  evidence: "`backend/src/modules/deals/deals.service.ts` ~L24-26 computes dealCode from countAllScoped()+1 with no transaction/lock, and there is no unique (tenant_id, deal_code) index, so two concurrent POST /deals in the same tenant can silently produce identical deal codes."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] The entire /uploads directory (deal documents, logos) is served statically with no auth or tenant check."
  evidence: "`backend/src/main.ts` L20 `useStaticAssets` serves UPLOAD_DIR under `/uploads` with zero permission gating, unlike the API endpoints that create these records. Filenames are random UUIDs (not brute-forceable) but there is no login requirement and no way to revoke a leaked URL."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] SVG is in the logo upload allow-list and served inline, permitting embedded-script execution on direct navigation."
  evidence: "`backend/src/modules/uploads/uploads.constants.ts` L6 ALLOWED_LOGO_MIME_TYPES includes image/svg+xml; combined with the static-serving gap above, a validly-typed SVG with an embedded <script> executes when the URL is opened directly."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] POST /uploads/logo only requires view-level permission (RELATIONSHIP_VIEW) for a mutating action."
  evidence: "`backend/src/modules/uploads/uploads.controller.ts` L25-31,37-39 uses ANY_RELATIONSHIP_PERMISSION (includes RELATIONSHIP_VIEW) instead of a create/update/manage permission, so a read-only role can write files."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] `multer@^1.4.5-lts.1` was added despite the lockfile's own advisory that 1.x has known vulnerabilities patched in 2.x, and multer 2.x is already present as a transitive dep."
  evidence: "`backend/package.json` L33, `pnpm-lock.yaml`."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] AddDealDialog silently skips the required-Sub-Stage check when the selected Main Stage currently has zero Sub Stages."
  evidence: "`frontend/src/components/funnel/AddDealDialog.tsx` runValidation() (~L241): `if (stages.length > 0 && !values.currentStageId)` — but currentStageId is a required @IsUUID() in create-deal.dto.ts regardless of how many options exist, so submission with no sub-stages hits a generic backend 400 instead of a clear client-side message."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] CompanyFormDialog's edit-mode contact rows are POSTed one-by-one with no email validation gate and no rollback tracking."
  evidence: "`frontend/src/app/[tenant]/(dashboard)/relationships/[id]/_components/CompanyFormDialog.tsx`: runValidation() (~L266-276) only checks values.name; per-row emailError (~L682) is display-only. In edit mode, contacts are POSTed in a loop (~L358-368); if a later row fails, earlier rows already exist server-side but the form shows one generic error, and retrying resubmits the already-created rows, duplicating them."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[MEDIUM] CompanyFormDialog can leave a stale parentCompanyName in the DB after switching a company to reference a parent by ID."
  evidence: "`CompanyFormDialog.tsx` ~L350 sends `parentCompanyName: values.parentCompanyId ? undefined : values.parentCompanyName.trim()`; JSON.stringify drops `undefined`, so the PATCH never clears the old column server-side (relationship-parties.service.ts Object.assign), contradicting company.entity.ts's own comment that the two fields are mutually exclusive."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[LOW] No magic-byte content sniffing anywhere in the upload pipeline; MIME/extension checks are client-supplied only (compounds the logo-upload XSS finding above)."
  evidence: "`backend/src/modules/uploads/uploads.controller.ts`, `backend/src/modules/deals/deal-documents.controller.ts`."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[LOW] `uploadDealDocument` bypasses the shared apiFetch 401-refresh-retry logic, so an expired token mid-dialog fails the upload outright (compounds the AddDealDialog duplicate-create bug above)."
  evidence: "`frontend/src/lib/api/deals.ts` ~L48 uses a raw fetch (to avoid apiFetch's forced JSON content-type) and loses the refresh-and-retry path other calls get."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[LOW] AddDealDialog sends `probability` as a raw Number() with no int/step constraint, but the backend DTO requires @IsInt()."
  evidence: "`AddDealDialog.tsx` ~L310; a decimal value passes client-side and only fails with a generic backend 400."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[LOW] A UTF-8 BOM was added to the top of globals.css, in the same commit that removes stray BOMs elsewhere to fix mojibake."
  evidence: "`frontend/src/app/globals.css` L1."

- source: commit `9fd864f` — code review, 2026-07-20
  summary: "[LOW] RoleDetailsDialog uses a raw \"—\" character instead of the `&mdash;` entity used in the other three files fixed by this same commit's em-dash cleanup."
  evidence: "`frontend/src/components/layout/RoleDetailsDialog.tsx` L43, L47."

## Deferred from: code review of Priority Tracker (commits `32fbec7^..e260c45`, Stories 1.1–1.4 + Story 1.11), 2026-07-24

- source: commit range `32fbec7^..e260c45` — Priority Tracker code review, 2026-07-24
  summary: "[LOW] Task detail-view lifecycle history is synthesized from the task row (createdAt/createdByName), not read from AuditLogService."
  evidence: "`TaskDetailDialog.tsx` builds the single 'Created' history entry from `task.createdAt`/`task.createdByName` rather than querying the audit log. The create path DOES write an `audit_logs` row correctly; only the read side bypasses it. Deferred by the code's own comment to Story 1.9 (the real event-by-event lifecycle trail). When 1.9's events land they won't surface here without rework."

- source: commit range `32fbec7^..e260c45` — Priority Tracker code review, 2026-07-24
  summary: "[LOW] Task detail dialog does not display the task's owner, though AC 1.4 lists 'owner' among the fields it should show."
  evidence: "`TaskDetailDialog.tsx` renders quadrant/status/progress/notes/history but no owner field. Deferred at review time because owner always equalled the viewer pre-delegation. NOTE: Story 1.6 (Delegate) has since been implemented in the working tree, so owner can now differ from viewer — revisit whether the owner should surface."

- source: commit range `32fbec7^..e260c45` — Priority Tracker code review, 2026-07-24
  summary: "[LOW] A user account linked to more than one non-deleted employee record makes GET /employees/me return an arbitrary one."
  evidence: "`employees.service.ts` `findByUserId` uses `findOneScoped({ where: { userId } })`; if >1 employee shares a userId it returns whichever the DB yields first. No `UNIQUE(userId)` constraint enforces one-to-one at the DB. Low probability, but a unique constraint (or deterministic ordering) would make it impossible."

- source: commit range `32fbec7^..e260c45` — Priority Tracker code review, 2026-07-24
  summary: "[LOW] GET /employees/me does two DB round-trips (bare findByUserId, then findOneOrFail with relations)."
  evidence: "`employees.controller.ts` `/me` handler. Read-only, no correctness risk; tenant scoping confirmed present (findByUserId uses findOneScoped). Could collapse to a single scoped relation-loaded query."

- source: commit range `32fbec7^..e260c45` — Priority Tracker code review, 2026-07-24
  summary: "[LOW] The board's optimistic order is never reconciled with the server's authoritative ranks after a successful move."
  evidence: "`PriorityBoard.tsx` `handleDragEnd` awaits `movePriorityTask()` but discards its returned task. If the server's resequence ever diverges from the optimistic order, the UI silently shows a different order than the DB until a full reload. (The HIGH parallel-write bug that could cause such divergence has now been fixed.)"

- source: commit range `32fbec7^..e260c45` — Priority Tracker code review, 2026-07-24
  summary: "[LOW] Clicking a task card immediately after a drag may spuriously open the detail dialog (needs browser verification)."
  evidence: "`PriorityBoard.tsx` `SortableTaskCard` carries both dnd-kit drag listeners and an `onClick` that opens the detail dialog on the same element. With `activationConstraint.distance: 8`, a completed drag can fire onClick on pointerup in some dnd-kit/browser combinations. Not confirmable from code alone — verify in the browser; if reproducible, suppress onClick when a drag actually occurred."

## Deferred from: Priority Tracker re-review (working tree, Stories 1.5 + 1.6), 2026-07-24

- source: working-tree re-review (Stories 1.5/1.6) — Priority Tracker code review, 2026-07-24
  summary: "[NOT DONE — do not accept as complete] Story 1.6 (Delegate a Task) is a front-end-only mock: no backend persistence, no ownership handoff."
  evidence: "There is no delegation/tracker table, migration, entity, endpoint, or service in the diff (only `priority_task_shares` was added). `DelegateTaskDialog.tsx` and `PriorityBoard.tsx` `handleTaskDelegated` mutate local React `order`/`delegatedTo` state only (self-documented as 'local-state-only'). `ownerId` is never reassigned; the auto-move into the delegator's DELEGATE quadrant and the 'Delegated to X' badge revert on page refresh; the recipient receives nothing. AC 1.6 (owner-only delegate to exactly one user, ownership handoff, recipient-visible delegated flag, auto-move persisted) is unimplementable to verify because no server path exists. Blocked on the epic's own unresolved 'Per-perspective task placement' architecture question (epics-task-management.md, Open Questions for Architecture). Decision (2026-07-24): mark not-done + track; flag/hide the Delegate UI so it is not presented as working; implement the real transactional backend once the data-model question is resolved."

- source: working-tree re-review (Stories 1.5/1.6) — Priority Tracker code review, 2026-07-24
  summary: "[LOW] Two concurrent task creates into the SAME EMPTY quadrant can still produce duplicate rank 1 (residual of the 'lock only' hardening choice)."
  evidence: "`priority-tasks.service.ts` `create()` takes a `pessimistic_write` lock on existing quadrant rows before computing max(rank)+1, but an empty quadrant has no rows to lock, so two concurrent creates both read 0 and persist rank 1. Accepted as out of scope when the concurrency-hardening approach was chosen as 'lock only' (no unique constraint) for this personal single-user board (2026-07-24). Closeable later with a partial `UNIQUE(tenant_id, owner_id, quadrant, rank) WHERE deleted_at IS NULL` (which would force a two-phase resequence) or an advisory lock keyed on (owner, quadrant)."

- source: working-tree re-review (Stories 1.5/1.6) — Priority Tracker code review, 2026-07-24
  summary: "[LOW] move()'s lock-then-lock ordering across two quadrants is a latent deadlock surface once delegation lets two owners touch the same task's rows."
  evidence: "`priority-tasks.service.ts` `move()` locks the from-quadrant rows, resequences, then locks the to-quadrant rows. Negligible today because every board's rows are `ownerId`-scoped to a single user, but when Story 1.6 (Delegate) is really built and a task can be touched by two owners mid-handoff, opposite-direction concurrent moves could invert lock order → Postgres deadlock. Acquire quadrant locks in a fixed global order (e.g. sorted quadrant keys) when 1.6 lands."

- source: working-tree re-review (Stories 1.5/1.6) — Priority Tracker code review, 2026-07-24
  summary: "[LOW] Shares to a since-disabled/soft-deleted user linger in the 'shared with' list."
  evidence: "`priority-task-shares.service.ts` `findAll` joins `sharedWithUser` and resolves the name even for soft-deleted/disabled users (FK `ON DELETE CASCADE` only fires on a hard delete; users are soft-deleted). Sharing with an inactive user is now blocked at add-time (fixed 2026-07-24), but pre-existing shares to a user later disabled still show. Filter `findAll` by the target's active status, or cascade-remove shares when a user is disabled."

- source: working-tree re-review (Stories 1.5/1.6) — Priority Tracker code review, 2026-07-24
  summary: "[LOW] Hardcoded `#fdf0ee` hover background on the unshare button violates the single-source color-token rule."
  evidence: "`TaskDetailDialog.tsx` unshare button uses `hover:bg-[#fdf0ee]` (a danger-tint) instead of a design-system token. Pre-existing shared convention (the same hover appears on other danger icon-buttons), so deferred pending a documented danger-tint token decision rather than spot-fixed here."

- source: working-tree re-review (Stories 1.5/1.6) — Priority Tracker code review, 2026-07-24
  summary: "[LOW] ShareTaskDialog can fire onShared after the dialog is dismissed if the POST is in flight when it closes."
  evidence: "`ShareTaskDialog.tsx` — closing via ESC/backdrop while the share POST is in flight lets the resolved `.then` call `onShared`/mutate parent state for a dialog the user already dismissed. Double-submit is already guarded (Button disabled on isLoading); this is the close-mid-request window. Track a mounted/cancelled ref and skip the callback if unmounted, or block Dialog onClose while saving."
