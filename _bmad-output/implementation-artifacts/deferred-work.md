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
