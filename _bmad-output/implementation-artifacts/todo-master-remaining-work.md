# Master Remaining Work — ORELIA CRM

**This is the one file to check.** Every open item — new bugs found today, and everything already
tracked across `deferred-work.md`, `todo-audit-infrastructure.md`, and
`todo-system-wide-i18n-and-permissions.md` — is inlined below in full. From now on, every new bug
or todo found gets added here directly, not to a new or separate file. Nothing else needs to be
opened to see the full picture.

Severity tags: 🔴 Critical (security/data-integrity, fix before calling anything "production
ready") · 🟠 High (real bug, visibly wrong behavior) · 🟡 Medium · ⚪ Low/polish.

---

## A. Today's Deals/Funnel findings

### 1. ✅ FIXED — Deal Status never transitioned + two related UX gaps found & fixed alongside it
**Where:** `backend/src/modules/deals/deals.service.ts::moveStage()`,
`frontend/src/components/funnel/FunnelSourceTabs.tsx`, `FunnelBoard.tsx`,
`frontend/src/app/[tenant]/(dashboard)/funnel/page.tsx`, `MainStagesWidget.tsx`.

**1A — the original gap.** `SubStage.isWon`/`isLost` existed but `moveStage()` never read them;
`deal.status` stayed `"open"` forever. **Fixed:** `moveStage()` now sets `deal.status =
targetStage.isWon ? Won : targetStage.isLost ? Lost : Open` right after loading `targetStage`
(already fetched there for the tenant check) — the `else → Open` branch matters, since moving a
deal back out of a Won/Lost stage must revert it, not leave it stuck. **Verified live**: marked a
real Sub Stage `isWon`, moved a real deal into it via `POST /deals/:id/move` → `status` flipped to
`"won"`; moved it back to a plain stage → reverted to `"open"`. Test data cleaned up after.

**1B — skip-confirmation on the Funnel overview board (found while scoping this).** Investigating
how Main-Stage-to-Main-Stage moves actually work surfaced that the tenant-wide `/funnel` board
(columns = Main Stages) let a drag skip over intermediate stages with zero warning, landing
silently on the target's first Sub Stage. Decided with the user: only this board needs a
skip-confirmation (the per-Main-Stage boards only ever show one stage's own Sub Stages, so there's
nothing to skip there); a confirmed skip persists immediately with no Undo toast (the confirmation
itself is the safety net); a normal adjacent move keeps the existing optimistic-move + 30s-Undo
behavior exactly as before. **Fixed:** `FunnelColumn` gained an optional `position` (Main Stage
sequence); `FunnelSourceTabs.tsx::handleMove()` now checks, only when `stageField ===
"mainStageName"`, whether the move's position gap is more than 1 — if so, shows the shared
`useConfirm()` dialog naming the skipped stage(s) by name before persisting; otherwise, completely
unchanged. Frontend typecheck clean (zero new errors vs. the tracked baseline). **Not
click-tested** — no browser automation available in this environment; logic traced and confirmed
correct, but the actual drag-and-confirm-dialog interaction hasn't been visually verified.

**1C — empty Main Stages are dead ends (found via the same investigation).** Querying the real
data showed 4 of 6 Main Stages (Discovery, Negotiation, Proposal Sent, Qualified) have zero Sub
Stages — meaning a deal can never actually be moved into them (blocked today with an existing
error toast, "This stage doesn't have any sub stages configured yet," which was already correct,
just silent until someone tries). **Fixed:** `MainStagesWidget.tsx` now shows a warning badge
("No sub stages") next to any Main Stage's name when its existing `dependentCount` (already the
active Sub Stage count, reused from the cascade-delete feature, no backend change needed) is `0`.
Decided with the user not to hard-block saving a Main Stage with zero Sub Stages — a Main Stage
has to exist before Sub Stages can be added under it, so a save-time block isn't practical; a
persistent, visible warning is the honest version of "enforce it." **Not click-tested** — same
browser-automation limitation as 1B; badge condition traced and correct, not visually confirmed.

### 2. ✅ FIXED — `expectedCloseDate` had no UI anywhere + Deal Card redesigned
**Where:** `AddDealDialog.tsx`, `ViewDealDialog.tsx`, `FunnelBoard.tsx`, `FunnelSourceTabs.tsx`,
`lib/data/funnel.ts`.
**What:** `FunnelSourceTabs.tsx::dealToFunnelLead()` read `deal.expectedCloseDate` to show a date
on the Funnel card, but no form ever let a user set it — the field was always `null` in practice.
**Fixed:** added an "Expected Deadline" date field (`<TextField type="date">`) to `AddDealDialog`'s
Deal Information tab, wired into both `createDeal`/`updateDeal` (same shared form covers create
and edit) — and a matching read-only `Field` in `ViewDealDialog`, consistent with how every other
Deal Information field is already shown there. **Also redesigned the Funnel board card** (user
request, expanded scope): `DealCard` now shows deal code (under the name), a color-coded status
badge (Open/Won/Lost/On Hold, same visual convention as the existing Won/Lost badges on Sub
Stages), and country (appended to the company line) — alongside the existing name, company, value,
expected date, and history icon. `FunnelLead` gained three new optional fields (`code`, `country`,
`status`) rather than backfilling the ~60-entry legacy mock dataset in `funnel.ts`, which no
component reads from anymore. **Verified live:** created a real deal via the API with
`dealCountry`/`expectedCloseDate` set, confirmed `dealCode`/`dealCountry`/`expectedCloseDate`/
`status`/`companyName` all round-trip in the exact shape the card reads them — test deal cleaned
up after. Frontend typecheck clean. **Not click-tested** — same browser-automation limitation as
1B/1C; the actual on-screen card layout hasn't been visually confirmed.

### 3. ✅ FIXED — Add-Deal button and drag-and-drop weren't permission-gated in the UI
**Where:** `FunnelSourceTabs.tsx` (Add New Deal button), `FunnelBoard.tsx` (drag-and-drop).
**What:** Backend already enforced `DEALS_CREATE`/`DEALS_UPDATE` correctly on `POST /deals` and
`POST /deals/:id/move` — this was a UX gap, not a security hole. A view-only user could open the
full Add Deal form or drag a card across columns and only find out it was rejected after
submitting. (Verified while scoping this: the Edit and Delete buttons in `ViewDealDialog` already
checked `DEALS_UPDATE`/`DEALS_DELETE` correctly — this gap was only the Create button and drag.)
**Fixed:** `FunnelBoard` gained a `canDrag?: boolean` prop (default `true`, so no other caller's
behavior changes) — when `false`, cards render non-`draggable` (cursor reverts to default too, so
it doesn't visually invite a drag that won't start) and the column drop handler no-ops. In
`FunnelSourceTabs.tsx`, the "Add New Deal" button is now wrapped in
`permissions.includes(DEALS_CREATE)`, and `canDrag={permissions.includes(DEALS_UPDATE)}` is passed
to `FunnelBoard`. Frontend typecheck clean.

### 4. ✅ FIXED — Sidebar showed Funnel/Deals links to users with no `DEALS_VIEW`
**Where:** `frontend/src/components/layout/Sidebar.tsx` (~L99-140, Funnel root link + Deals group).
**What:** Every other nav group (CRM Configuration, System Administration) is filtered through the
existing `hasAnyPermissionForPrefix(permissions, prefix)` helper (defined at L23, used at L73/76)
— built earlier this session specifically to fix this exact class of bug. The Funnel root link and
the Deals group's per-Main-Stage sub-links are the one place that check was never added: they
render unconditionally for every authenticated user. Not a data leak — `GET /deals` etc. are
correctly gated server-side — but a `DEALS_VIEW`-less user sees a link into a board that will load
empty/error, which is exactly the inconsistency `hasAnyPermissionForPrefix` was built to prevent
everywhere else.
**Fixed:** wrapped both the Funnel root link and the Deals group (toggle + submenu) in
`Sidebar.tsx` with `hasAnyPermissionForPrefix(permissions, "deals")` — identical to every other
section. Frontend typecheck clean.

### 5. ✅ FIXED — `deals.service.ts::create()` didn't validate FK ownership — cross-tenant data leak
**Where:** `backend/src/modules/deals/deals.service.ts::create()`/`update()`, `deals.module.ts`.
**What:** `companyId`/`contactId`/`sourceId`/`departmentId`/`ownerId`/`preSalesPersonId`/`pmoId`
are passed straight from the DTO into `createScoped({...dto, ...})` with no check that any of them
belong to the current tenant or are still active. `DealsRepository`'s `leftJoinAndSelect`s join on
the raw FK, not `(tenantId, id)`. Confirmed exploitable shape: a soft-deleted test company was
silently accepted as a deal's customer during this session's own testing. Worse than a data-
integrity nicety — a Tenant A user who knows or guesses a real UUID belonging to Tenant B's
Company/Contact/Employee can link a deal to it, and `DealResponse` will then resolve and return
that other tenant's `companyName`/`ownerName`/etc. inside Tenant A's own API response. This is the
same class of bug already found and fixed once this session in `deal-partners.service.ts`
(`addCompany()`/`addContact()` now resolve through `CompaniesRepository`/`ContactsRepository`'s
tenant-scoped `findOneScoped()` first).
**Fixed:** added a `validateReferences(dto)` helper to `DealsService` that resolves every non-null
`companyId`/`contactId`/`primaryContactId`/`sourceId`/`departmentId`/`ownerId`/
`preSalesPersonId`/`pmoId` through its owning repository's `findOneScoped(id)`
(`CompaniesRepository`/`ContactsRepository`/`DealSourcesRepository`/`DepartmentsRepository`/
`EmployeesRepository` — the latter three newly wired into `DealsModule`), throwing
`NotFoundException` on any miss. Called from both `create()` and `update()`.
**Verified live:** cross-tenant `companyId` on create → 404 (previously would have leaked the
other tenant's company name into the response); soft-deleted `departmentId` and a fabricated
`sourceId` on update → 404 each; real same-tenant ids on both create and update → succeed
unchanged. Backend typecheck clean. Test deal cleaned up after verification.

### 6. ✅ FIXED — Dead permission `DEALS_STAGE_UPDATE` removed (code + database)
**Where:** `common/src/constants/permissions.ts`, `rbac_resources`/`rbac_role_resource_map` tables.
**What:** the key was referenced nowhere in the codebase (`POST /deals/:id/move` used
`DEALS_UPDATE` instead), but was seeded in `rbac_resources` and granted to both Admin and Super
Admin — a checkbox that did nothing when toggled either way.
**Fixed:** deleted the constant from `permissions.ts`; deleted the two `rbac_role_resource_map`
grant rows (Admin, Super Admin) and the `rbac_resources` row itself directly in the database
(deleting the constant alone never would have — the seed script only ever adds missing
permissions, it doesn't remove retired ones, same shape as the earlier `deal_sources:manage`
orphan). **Also rebuilt `@orelia/common`** — its compiled `dist` output is what backend/frontend
actually import at runtime, and it was still stale with the old key even after the source change;
missing this would have meant the fix silently didn't apply until some unrelated future rebuild.
Backend and frontend typecheck clean, backend restarted with "Found 0 errors," DB verified: zero
rows left referencing the deleted resource.

### 7. ✅ FIXED — Logout button silently failed after a long-idle/expired session; no auto-logout
**Reported by user, root-caused and fixed.**
**Where:** `frontend/src/components/layout/AccountMenu.tsx::handleLogout()` (L38-48) +
`frontend/src/lib/api/client.ts::apiFetch()` (L32-82).
**What actually happens:** leaving a tab open and idle for hours means no page navigation ever
occurs, so `middleware.ts`'s proactive refresh — which only runs on a Next.js server-side
navigation, never while sitting idle on an already-rendered client page — never fires. By the time
Logout is clicked, both the access token is dead and (going by the observed behavior) the refresh
attempt `apiFetch` makes internally on the 401 also fails. `apiFetch` then throws `ApiError`.
`handleLogout()`'s catch block is:
```ts
} catch {
  setIsLoggingOut(false);
}
```
— it only resets the spinner. No redirect, no error, no fallback. The click visibly does nothing,
matching the report exactly. Refreshing the page afterward runs `middleware.ts`, which resolves
the dead session one way or another before the page renders — so by the time Logout is clicked a
second time, the app is in a clean state and the click works normally.
**Fixed, two parts:**
- `AccountMenu.tsx::handleLogout()` now redirects to `/${tenantSlug}` (and `router.refresh()`)
  unconditionally — the `logout()` call is still attempted inside try/catch, but the redirect runs
  either way instead of only on success.
- `client.ts::apiFetch()` now calls a new `redirectToLogin()` (derives the tenant slug from
  `window.location.pathname`, no-ops if already there) the moment `refreshSession()` resolves
  `false` — i.e. the session is definitively dead, not just the access token. This fires for
  *every* `apiFetch` caller, not just Logout.
**Verified:** frontend typecheck clean (zero new errors — pre-existing baseline errors in
unrelated files untouched), frontend compiles and serves after restart, and the real backend
trigger condition confirmed live (`POST /auth/logout` with no session cookies → real `401`, same
path `refreshSession()` hits). **Not verified**: an actual click-through in a running browser —
no `chromium-cli`/Playwright available in this environment to drive one. Logic and the real
backend-side trigger are confirmed; the click-and-watch-it-redirect step is still open if you want
that level of proof.

---

## B. Pre-existing code-review findings — not yet fixed

### 🔴 High severity, still open
- `backend/src/modules/uploads/uploads.controller.ts:49-52` + `main.ts:20` — stored file
  extension comes from client-supplied `originalname`, independent of the (also spoofable)
  MIME check; an `evil.html` uploaded as `image/png` is stored as `<uuid>.html` and served live,
  unauthenticated, by `express.static` — **stored XSS with session cookies attached.**
- ✅ **FIXED** — `AddDealDialog.tsx`'s create-submit handler used one shared try/catch across
  `createDeal()` and the follow-up document/partner/note `Promise.all`. If any follow-up call
  failed, the user saw a misleading "Failed to create deal" even though the deal was already
  created, and resubmitting called `createDeal()` again with identical fields — a real duplicate
  deal. **Fixed:** split into two separate try/catches. A `createDeal()` failure behaves exactly as
  before (form stays open, real error shown, nothing was created). Once the deal exists, a failed
  attachment no longer blocks anything — it shows a non-blocking toast ("Deal DEAL-XXXXX was
  created, but one or more attachments failed to save... you can add them again from View Deal")
  and the dialog still closes normally via `onCreated`, so there is no longer any path where a
  successful creation looks like a failure. Frontend typecheck clean. **Not click-tested** — same
  browser-automation limitation as the rest of this session; this is a pure client-side
  control-flow change with no new API contract to verify via curl, so it was logic-traced rather
  than run.
- ~~`CalendarWidget.tsx` UTC/local-time grid bug~~ — **moot.** The entire Calendar feature (page,
  widget, Sidebar link, `.cal-*` CSS) was removed outright per the user's decision — it was
  self-contained mock data with no backend integration (confirmed before deleting: no API calls at
  all, just local `useState` + dummy reminders), so removal was a clean, fully isolated deletion.
  The backend `reminders`/`notifications` entities/migration were deliberately left alone — nothing
  ever called them either way, and dropping DB schema is a separate, harder-to-reverse decision not
  made here. Verified live: `GET /calendar` now 404s, dashboard/sidebar unaffected, frontend
  typecheck clean, zero remaining references to "calendar" anywhere in the frontend source.
- *(Already resolved, kept for the record)* `deal-contacts.service.ts` cross-tenant contactId
  gap — fixed by the `deal-partners.service.ts` rewrite, verified 2026-07-20.

### 🟡 Medium severity
- ✅ **FIXED** — `deals.service.ts` deal-code generation had no transaction/lock and no unique DB
  constraint. Added migration `1784700000004-AddUniqueDealCodePerTenant` (unique `(tenant_id,
  deal_code)` index) plus a retry loop in `create()`: on a `23505` conflict, recompute the count
  and retry (up to 3 attempts) instead of letting a duplicate through. **Verified live**: a raw
  duplicate insert against the real DB was rejected by the constraint; a real `POST /deals` still
  creates cleanly with a fresh unique code afterward.
- **Deferred to the user's own S3 migration** (not fixed here, by their own decision): `/uploads`
  served with zero auth check, SVG allowed + served inline (XSS), `POST /uploads/logo` gated on a
  view permission, `multer` version. All four go away or change shape once storage moves off local
  disk — revisit after that migration, not before.
- ✅ **FIXED** — `AddDealDialog`'s Sub-Stage requirement had silently drifted: the field itself was
  removed from the UI in a later refactor (`currentStageId` is now auto-defaulted to
  `stages[0]?.id`), so the *original* skip-condition no longer exists in that shape — but the
  underlying gap was still real: when zero stages exist, the default resolves to `""` with no way
  to fix it, hitting an unexplained backend 400. Added a `runValidation()` check that blocks
  submission with a clear message ("No stages are available to create a deal in yet...") instead.
  Frontend typecheck clean; client-side only, not click-tested (no browser automation here).
- ✅ **FIXED** — `CompanyFormDialog` edit-mode posted new contact rows one-by-one with no tracking
  of which had already succeeded; a failure partway through duplicated earlier rows on retry.
  Added a `savedContactKeysRef` (keyed by each row's stable `key`) that skips re-posting any
  contact already successfully saved in an earlier attempt within the same dialog session.
  Frontend typecheck clean; client-side only, not click-tested.
- ✅ **FIXED** — `CompanyFormDialog` left a stale `parentCompanyName` in the DB after switching to
  a parent-by-ID reference, because `undefined` is dropped by `JSON.stringify` and never reached
  the server as a clear signal. Now sends `null` (matching every sibling optional field's existing
  clear-with-null convention) — required widening `UpdateCompanyRequest.parentCompanyName` and
  `UpdateRelationshipPartyCompanyDto` to accept `null`, not just the frontend call site. **Verified
  live**: created a real company with a free-text parent name, linked it to a real parent company
  via the API, confirmed `parentCompanyName` came back `null` in the response and the database.
  Test data disabled afterward.

### ⚪ Low severity
- **Deferred to the user's own S3 migration**: no magic-byte content sniffing anywhere in the
  upload pipeline — same reasoning as the Medium-severity upload items above.
- ✅ **FIXED** — `uploadDealDocument` used a raw `fetch` with no 401-handling at all, so an expired
  token mid-dialog failed the upload outright. `refreshSession`/`redirectToLogin` are now exported
  from `client.ts` and reused here (still a raw `fetch`, not `apiFetch` — multipart bodies need the
  browser's own boundary-bearing `Content-Type`, which `apiFetch`'s forced JSON header would
  break) — same 401 → refresh → retry-or-redirect shape as every other call in the app. **Verified
  live**: a real document upload against the real backend still succeeds end-to-end (`201`,
  correct response shape) after the change.
- **Stale, already resolved by a later refactor — no action needed**: `AddDealDialog`'s
  `probability` field finding (the field no longer exists anywhere in the current form) and
  `RolePermissionsDialog`'s prefix-stripping finding (already rewritten to use
  `.slice(prefix.length + 1)`, not the `.replace()` pattern the finding described — already
  correct regardless of repeated substrings).
- ✅ **FIXED** — the search input in `RolePermissionsDialog` had no accessible label (the Level/Risk
  filter selects already did, from an earlier pass) — added `aria-label="Search permissions"`.
- ✅ **FIXED** — `.permissions-grid`/`.permissions-*` used hardcoded `#f8fafc` in four neutral
  surface-color rules instead of the shared `var(--color-bg)` already used throughout the rest of
  `globals.css` (the semantic risk/status-tag colors elsewhere in the same block were left as
  intentional hardcoded hex — matching the same deliberate multi-color badge convention used for
  Won/Lost elsewhere in this app, not an inconsistency). Added a `@media (max-width: 700px)`
  breakpoint collapsing the grid to one column.
- ✅ **FIXED** — `AccountMenu`'s Log out item forced a solid red fill with `!important`, completely
  overriding the shared `.account-menu-item:hover` rule and giving a fully reversible action the
  same visual alarm as a genuine delete. Replaced with a plain red text tint — the shared hover
  background now applies normally, same as every other menu item.
- ✅ **FIXED** — `RoleFormDialog`'s and `TenantFormDialog`'s required-field markers (`"Name *"` etc.)
  were cosmetic text only, no `required`/`aria-required` on the actual input. Added both to Role's
  Name field and Tenant's Name/Slug/Contact email/Phone fields.
- **Skipped, not a real issue**: the stray em-dash character in `RoleDetailsDialog.tsx` — it lives
  inside a JS string/template literal (a dialog title and a fallback display value), not a raw JSX
  text node, so the `&mdash;` HTML entity the original finding suggested would **not** decode there
  at all — it would show the literal text "&mdash;" instead of an em-dash. Swapping it would have
  been a real regression, not a fix. Left as a plain `—` character, which renders correctly.
- ✅ **FIXED** — `globals.css` had a genuine stray UTF-8 BOM at byte 0 (confirmed via hex dump).
  Stripped.

All frontend typechecks clean (zero new errors vs. the tracked baseline) across every file touched
in this round. CSS/behavior changes not click-tested — same browser-automation limitation as the
rest of this session.

---

## C. Standing infrastructure rollouts (one-time build items, ship module-by-module)

### Deep debug logging retrofit — ✅ **100% COMPLETE** (2026-07-22)
Every backend module in the codebase now meets the "Deep debug logging inside every backend
endpoint" standard: entry log with inputs, a debug line for every conditional branch actually
taken, a result-count/outcome log on the way out, and the whole method body wrapped in
try/catch+rethrow (never swallowed) — at **both** the controller and service layer, everywhere.
Rolled out this session: Deals (all sub-services, including `remove`/`moveStage` which had zero
and partial logging respectively), Departments, Deal Sources, Teams, Relationship Parties, RBAC,
Users, Tenants, and the rest of Auth (`login`/`refresh`/`logout`/`me`/`act-as-tenant`/
`exit-act-as-tenant` — previously only `verify-password` had this). Users and Auth both required
deliberate care to never log a plaintext password, raw token, or token hash anywhere — verified
live with zero leakage in both.

### `AuditLogService` rollout — ✅ **COMPLETE for every module where it applies**
Done for: Relationship Types, all of Deals (`deals.service.ts`, `deal-notes.*`,
`deal-documents.service.ts`, `deal-partners.service.ts` — also fixed a real gap where `DELETE
/deals/:dealId/partners/:partnerId` never received the caller's user id), Departments, Deal
Sources, Teams, Relationship Parties (with a proper audit-entity split: `company`/`contact` for
field changes, `relationship_party` for the tagging relationship itself), RBAC (role-permission
assignment audits the full before/after `resourceIds` set, not just a count), Users, Tenants.
**Deliberately not added** to `deal-stage-history.service.ts` (its own history rows already are
the permanent audit trail for stage moves — a second entry would be circular) or to Auth
(login/refresh/logout are session-lifecycle events, not entity CRUD — outside this rollout's
scope by design, same reasoning as stage history).
**Real gaps found and fixed along the way, not just missing logs:** Tenants' `create()`/`update()`
never set `createdBy`/`updatedBy` at all (no `@CurrentUser()` even reached the service); Deal
Partners' `remove()` had the same gap.
**Verified live** across every module: real create/update/delete cycles through the actual API,
confirmed every debug-log line in `docker logs` and every `audit_logs` row in the database at each
step, for all 8 modules touched this session.

### API Endpoint Registry (`api-endpoint-registry.md`) — ✅ **COMPLETE**
Every module now has a full per-endpoint table: Deal Documents/Partners/Stage History (previously
just prose summaries), Departments, Deal Sources, Teams, Relationship Parties, RBAC, Users,
Tenants, and the full Auth module (previously only `verify-password` was documented, five other
real endpoints were undocumented). `/deals/:id/move`'s Debug Logging column corrected from ⬜ to ✅.

### Enforce `createdBy` NOT NULL at the DB level — ⚠️ **attempted, correctly reverted, not viable as originally scoped**
Every service path was confirmed this session to always set `createdBy` on insert (the
precondition this task itself required). Tried a `CHECK ("created_by" IS NOT NULL) NOT VALID`
constraint per-table (the standard Postgres idiom for "enforce going forward without failing on
existing rows") on all 26 tables that have the column. Migration ran clean, and it correctly
rejected a fresh test insert with a NULL `created_by`.
**But live verification caught a real, serious problem before this got left in place**: Postgres
CHECK constraints re-validate the **entire row** on every UPDATE, not just the columns being
changed. Every table has real historical rows with a legitimate NULL `created_by` from
seed/system data (56 in `rbac_resources` alone, plus the seeded admin `users` row, the seeded
tenants, plans, industries, etc. — exactly what this task's own original note warned about). Once
the constraint existed, **any future update to one of those rows failed outright** — including
logging in as the seeded admin account, since `login()` updates `lastLoggingAt`/`loggingAttempts`
on that same row. Confirmed via the real API: `POST /auth/login` started returning `500
QueryFailedError: ... violates check constraint "CHK_users_created_by_not_null"`.
**Reverted immediately** (`migration:revert`, then deleted the migration file) and confirmed login
works again.
**Why this is correctly abandoned, not just deferred**: doing this safely would require first
backfilling every historical NULL `created_by` with a real actor id — but there is no "system"
user in this schema to attribute seed data to, and inventing a placeholder UUID not tied to a real
person would misrepresent the audit trail this whole rollout exists to make trustworthy. The
practical protection already exists at the application layer (every `create()` in the codebase now
verifiably sets it), which is proportionate to the actual risk — DB-level enforcement here costs
more (breaks real historical rows) than it protects against (a service path regression that would
show up immediately in the debug-log trail this session just built out everywhere). Not
recommended to revisit unless a real "system actor" concept gets added to the schema first.
`updated_by` was never attempted at all — verified directly against the data that it's correctly,
expectedly NULL for the majority of rows in every table (most rows have simply never been edited
since creation), so a NOT NULL constraint there would be actively wrong, not just risky.

---

## D. Read-only View-mode for admin section dialogs — ✅ **COMPLETE, all 9 sections** (2026-07-22)

Deals already had this (`ViewDealDialog`). Of the other 9 admin sections:
- **Tenants, Users, Roles were already done** before this pass started — each has its own
  dedicated `*DetailsDialog` component (`TenantDetailsDialog.tsx`, `UserDetailsDialog.tsx`,
  `RoleDetailsDialog.tsx`), already correctly gated on the resource's own `_VIEW` permission, row
  click already wired up. The doc just hadn't been updated to reflect that. (Also fixed a small,
  unrelated, genuinely broken mojibake character — `âœ“` instead of `✓` — found incidentally while
  verifying `RoleDetailsDialog.tsx`.)
- **Departments, Main Stages, Sub Stages, Deal Sources, Relationship Types, Teams** built this
  session: each `*FormDialog` gained a `mode: "create" | "edit" | "view"` (widened from just
  create/edit), disabling every input and swapping the Save button for a single Close button when
  `mode === "view"`; each corresponding `*Widget.tsx` now opens `{mode: "view"}` on row click for a
  `canView`-but-not-`canUpdate` user instead of doing nothing. Two fields (Sub Stages' Main Stage
  picker, Tenants-adjacent Deal Source's category, Tenant's Plan/Industry/Status) use the
  pre-existing `.field-locked-value` CSS class for a static read-only display instead of the
  interactive `CustomSelect`, since that shared component has no `disabled` prop of its own —
  matching the same "locked field" convention already established in `AddDealDialog`.
  Relationship Types also needed its own `canView` permission check added (`RELATIONSHIP_TYPE_VIEW`
  existed as a permission but the widget never checked it) and its row made clickable for the
  first time (it previously had no row-click behavior at all, edit-icon-only).
Every dialog typechecks clean against the tracked baseline. Not click-tested — same
browser-automation limitation as the rest of this session.

---

## E. i18n rollout

Not started. Retrofit one section at a time once the actual mechanism (library, file layout,
language-switch plumbing) is decided as its own first step:
Tenants/Roles/Users/Teams → Relationship Types/Deal Sources/Main Stages/Sub Stages/Departments →
Relationships → Employee Management → shared UI primitives' own built-in text.

---

## F. Relationship-Type-scoped Company/Contact tagging — found 2026-07-23

Three related items, discovered together while investigating why the Add Deal dialog's Customer
and Partners fields looked "off." The first is already fixed and committed; the other two are
design-agreed but not yet built.

### F1. ✅ FIXED — Company-owned contacts double-counted as independent Relationship-Type parties
**Where:** `backend/src/modules/relationship-types/relationship-parties.service.ts` (`addCompany`,
`addContact`), `relationship-parties.controller.ts`, `CompanyFormDialog.tsx`.

**What:** Every contact added under a Company (either inline at company-creation, or from the
company's own edit form) was getting its own independent `relationship_company_contact_map` row,
tagged with the same Relationship Type as the company itself — e.g. tag "Acme Corp" as Customer
with two contacts (Jane, Bob) attached, and the Customers list showed **3** entries (Acme Corp,
Jane, Bob), not 1. The same inflation hit the dependent-count shown next to each Relationship Type
and the cascade-delete warning count, since both are driven by the same table.

**Why:** A contact who merely works at a customer company isn't itself a customer — only the
company is. The map row was meant to express "this Company/Contact is directly and independently
tagged with this type," but company-owned contacts were getting one purely as a side effect of
being added to the company's own contact list, with no way for the list/count queries to tell the
two cases apart.

**How:** `addCompany`'s inline-contacts loop and `addContact` (when called with a `companyId`, the
path used by "add a new contact to an existing company" from the edit form) no longer create a map
row — the `Contact` row itself (with `companyId` set) is still created exactly as before. Since
company-owned contacts no longer ride along on the party list that used to make them visible, added
`GET .../parties/companies/:mapId/contacts` (queries `Contact` directly by `companyId`, bypassing
the map table entirely) and wired it into `CompanyFormDialog.tsx`'s edit mode so existing contacts
stay visible — read-only for now, see F3 below for why editing them isn't wired in yet.

**Status:** Done, committed (`27167ba`, `fix(relationships): stop company contacts double-counting
as independent relationship parties`). Not click-tested end-to-end in a running instance — this
environment has no installed dependencies (`node_modules`/`common/dist` don't exist, `pnpm`/`tsc`
unavailable), so the fix was verified by careful reading, not a real build/run. **Also not done**:
existing (pre-fix) company contacts still have their old bogus map rows sitting in the database —
the fix stops new bad rows, it doesn't retroactively clean up old ones. Optional one-time cleanup,
not scheduled.

### F2. 🟠 Add Deal's Customer and Partners fields show every Company/Contact in the tenant, not just ones tagged with the matching Relationship Type
**Where:** `frontend/src/components/funnel/AddDealDialog.tsx` (`otherPartyOptions`,
`partnerOptions`), `backend/src/modules/pickers/pickers.controller.ts`,
`companies.service.ts::findPicker`, `contacts.service.ts::findPicker`.

**What:** The Customer field and the Partners field in Add Deal both pull from the exact same
unfiltered source — `GET /pickers/companies` + `GET /pickers/contacts`, tenant-scoped and
name-search-filtered only:
```ts
const qb = this.companiesRepo.queryBuilderScoped("company").orderBy("company.name", "ASC").take(20);
if (search?.trim()) qb.andWhere("company.name ILIKE :search", { search: `%${search.trim()}%` });
```
No join to `relationship_company_contact_map`, no `relationshipTypeId` filter anywhere. A company
tagged as a Vendor, or not tagged with any Relationship Type at all, shows up identically to one
tagged Customer when picking a deal's customer — and the exact same list, minus whoever's already
picked, is reused as-is for Partners.

**Why:** A Deal's "customer" and "partners" fields are meant to represent specific business
relationships (who this deal is being sold to, who's partnering on it) — not "any company/contact
that happens to exist in the tenant." Confirmed with the user this is the intended behavior:
Customer should only offer parties tagged as the tenant's Customer type; Partners should only offer
parties tagged as the tenant's Partner type.

**How — agreed design, not yet built:** `relationship_types` has no way today to identify *which*
row means "Customer" versus an ordinary custom tag (`{ id, name }` only, fully tenant-renameable) —
matching by the literal string "Customer" would break under multi-tenancy (different tenants name
their types differently; a rename breaks the match). Agreed approach: add a nullable `systemRole`
column to `relationship_types` (`CUSTOMER` / `PARTNER` / null for ordinary custom types), with a
partial unique index so a tenant can have at most one type flagged per role. Tenant admin sets the
flag once, on whichever of their own Relationship Types should play that role, via a new field on
the existing Relationship Types create/edit form — the flag travels with the row, independent of
whatever the type is named or later renamed to. The Deal pickers then resolve "this tenant's
Customer-role type id" once, and filter the company/contact picker through
`relationship_company_contact_map` using that id — falling back to an empty state pointing at
Relationship Types admin if the tenant hasn't configured the role yet, not silently showing
everything (today's behavior) or erroring.

Touches: migration (new nullable column + partial unique index), `RelationshipType`
entity/DTOs/service (validate one-per-role-per-tenant on create/update), Relationship Types admin
form UI, two new/adjusted picker endpoints (role-scoped, replacing the plain company/contact
pickers for these two specific fields only — every other consumer of `/pickers/companies|contacts`
is unaffected), `AddDealDialog.tsx`'s Customer/Partners fields, `api-endpoint-registry.md`, plus
this project's standing rules (audit logging on the role-flag change, debug logging on the new
endpoints, i18n for any new label text).

**Status:** Design agreed with the user, not started. Real gap — verified via direct code read
(`AddDealDialog.tsx:583-606`, `pickers.controller.ts`, both `findPicker` methods), not assumed.

### F3. Related, separate task — no way to tag an existing Company/Contact under an additional Relationship Type
**Where:** `relationship-parties.service.ts`/`.controller.ts`, `RelationshipViewWidget.tsx`.

**What:** Today, the only way to get a Company/Contact tagged under a Relationship Type is
`addCompany`/`addContact` — both of which always create a **brand-new** Company/Contact row. There
is no "pick an existing Company/Contact and just add this tag" action anywhere.

**Why:** Raised by the user during the F2 discussion — a company that already exists (e.g. tagged
Supplier) shouldn't need to be re-created from scratch just to *also* be tagged Partner. The
underlying data already supports one Company/Contact holding multiple Relationship Type tags
simultaneously (checked: no uniqueness constraint on `relationship_company_contact_map` blocks
more than one row per company across different types) — the only missing piece is the UI/API
action itself.

**How — not designed in detail yet:** likely a new "Add existing" option alongside today's
"Add Company"/"Add Contact" actions in `RelationshipViewWidget.tsx`, backed by a picker-driven
dialog (search existing companies/contacts, same picker pattern used elsewhere) and a new
service method that creates only the map row for an existing party id under the target
Relationship Type — no new Company/Contact record, no duplication.

**Status:** Deferred, explicitly agreed with the user to log rather than build now (F2 is the
priority). Not designed beyond the shape above.

---

## G. Production RDS migration + Auth cross-tab session sync — 2026-07-23

Two unrelated threads of work done back-to-back this session: moving the deploy server off its
shared container Postgres onto a dedicated RDS instance, and implementing the two fixes from
`plan-auth-cross-tab-session-sync.md`. Both surfaced real, previously-undocumented gaps.

### G1. ✅ FIXED — Backend couldn't connect to RDS at all — two separate root causes found in sequence
**Where:** `docker-compose.yml` (on the deploy server, EC2 `18.142.49.168`), `backend/src/database/data-source.ts`, `backend/src/database/database.module.ts`, `backend/src/config/env.validation.ts`.

**Root cause 1 — port conflict, not a credentials bug.** After updating the server's `.env` to
point at the new RDS endpoint, `docker compose up` for `backend` also tried to start nexus-crm's
own local `postgres` service (a `depends_on`), which failed to bind host port 5432 — already held
by `goldbond-postgres`, an unrelated project's container sharing the same EC2 box (this is the
exact same shared-Postgres risk already flagged in `plan-production-deployment.md`'s Phase 3).
**Fixed on the server** (not yet committed — see G3 below): removed the `postgres:` service block
and backend's `depends_on: postgres` entry from `docker-compose.yml`, since RDS is now the real
database and the local container was never needed once RDS is live.

**Root cause 2 — RDS requires SSL, TypeORM wasn't configured for it.** Once the port conflict was
cleared, `migration:run` failed with `no pg_hba.conf entry for host ... no encryption` — RDS
rejects unencrypted connections by default; `psql` had silently auto-negotiated SSL (libpq's
default `sslmode=prefer`) during earlier manual connectivity checks, masking this until the real
TypeORM connection (Node's `pg` driver, which does not auto-negotiate SSL) was attempted.
**Fixed:** added `DB_SSL` (Joi-validated, default `false` so the local docker-compose Postgres
container is unaffected) to `env.validation.ts`, wired into both connection paths —
`database.module.ts`'s live `TypeOrmModule.forRootAsync` and `data-source.ts`'s migration-CLI
config — as `ssl: { rejectUnauthorized: false } | false`. `rejectUnauthorized: false` skips CA
chain validation rather than pinning the AWS RDS CA bundle — a pragmatic tradeoff, not the most
rigorous option; revisit once this is running for real. Committed `a854eed`.

**Verified live:** `docker compose config` confirmed the resolved backend env pointed at the real
RDS endpoint; `migration:run` executed every migration cleanly against RDS, ending on
`AddRefreshTokenGraceWindow1784700000008`; `seed` ran; tables + rows confirmed visible via DBeaver
(SSH-tunneled through the same EC2 instance). **Not yet confirmed:** an actual login through the
real app UI against the now-populated RDS database — DBeaver showing data proves the DB is
correct, not that the full auth round-trip works end-to-end.

### G2. 🟡 Real secrets were exposed in this chat session — needs rotation
**Where:** RDS `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (server `.env`).
**What:** `docker compose config` was run to debug the connection above and printed all three in
plaintext into the chat transcript while troubleshooting. Flagged live at the time; not yet acted
on as of this writing.
**To do:** rotate all three — change the RDS user's password (RDS console or `ALTER USER`),
generate fresh JWT secrets (`openssl rand -hex 32`, matching the README's own setup instructions),
update the server's `.env`, `docker compose up -d --force-recreate backend`. Low urgency but not
zero — don't let it linger indefinitely.

### G3. 🟡 `docker-compose.yml`'s local-`postgres`-removal fix exists only on the deploy server, uncommitted
**Where:** `docker-compose.yml`.
**What:** G1's fix (deleting the `postgres:` service + backend's `depends_on: postgres`) was made
directly via `nano` over SSH on the live server — it was never committed to the repo. The
git-tracked `docker-compose.yml` still defines the local `postgres` service today. Anyone who
re-clones or redeploys fresh (a new server, a teammate) will hit the exact same port-conflict bug
G1 already diagnosed and fixed once.
**To do:** get the server's current `docker-compose.yml`, commit the same fix properly into the
repo, so the deploy server and git stop disagreeing about the compose config.

### G4. Auth cross-tab session sync (`plan-auth-cross-tab-session-sync.md`) — both fixes implemented, neither live-verified
**Where:** `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/users/entities/refresh-token.entity.ts` (Fix A, commit `a70af45`); `frontend/src/lib/auth/tab-sync.ts`,
`frontend/src/components/providers/TabSyncListener.tsx`, `frontend/src/lib/api/auth.ts` (Fix B,
commit `11b148b`).
**What:** Fix A (10s grace-window reuse for a just-rotated refresh token, fixing the two-tabs/
proactive-vs-reactive refresh race) and Fix B (`BroadcastChannel`-based cross-tab reload on
login/logout, fixing the silent-identity-switch bug) are both built and typecheck-clean. Neither
has been run against a real, live two-tabs-open scenario — this session's environment had no
running server until the RDS work above stood one up.
**To do — the plan doc's own Section 6 verification steps, now actually possible against the live
RDS-backed server:**
1. Fix A: reproduce the actual race (two near-simultaneous `POST /auth/refresh` calls presenting
   the same token — e.g. two browser tabs open, or curl twice back-to-back), confirm both get the
   identical new pair instead of one hard-401ing; confirm reuse *past* the 10s window still 401s;
   confirm a normal single-caller refresh is unaffected.
2. Fix B: two real tabs open and logged in, log in as a different user in one, confirm the other
   silently reloads and reflects the new session; log out in one, confirm the other reloads to
   login.

---

## Recommendation — what to actually finish today

"Production ready, no bugs, today" and "fix everything in this document today" are different
goals — this list, taken whole, is easily a week of work. Here's the trade-off, not a verdict:

**Do today, in this order** (each is small-to-medium, each is a real bug or a real security gap,
none blocks the others):
1. **#5 (🔴 cross-tenant FK leak in `deals.service.ts::create()`)** ✅ **done, verified live.**
2. **#7 (logout/session-death)** ✅ **done, verified to the extent this environment allows (no
   browser automation available for the actual click-through).**
3. **#1 (Won/Lost status + skip-confirmation + empty-stage badge)** ✅ **done — backend half
   verified live, frontend halves logic-traced but not click-tested (no browser automation here).**
4. **#4 (Sidebar gating)** and **#3 (Add/drag gating)** ✅ **done — both compile clean, not
   click-tested (no browser automation available).**
5. **#6 (dead permission cleanup)** ✅ **done — TS constant, DB grant rows, and the `rbac_resources`
   row all removed; also rebuilt the `@orelia/common` package, since its runtime `dist` was stale
   and wouldn't have picked up the change otherwise.**
6. **#2 (`expectedCloseDate` UI + Deal Card redesign)** ✅ **done, verified live via the real API
   round-trip; card layout not click-tested (no browser automation available).**

**All 7 new findings from this session are now fixed.** What's left is everything in Sections
B–E below — none of it was part of the original 7, all of it was already known to be a
longer-term, module-by-module or multi-session effort, not a "finish today" item.

**Do not try to also start today:** the Medium/Low items in Section B (real, but none are
launch-blocking for a first production pass), the Section C infrastructure rollouts (deliberately
incremental, module-by-module by design), Section D, or Section E (i18n is explicitly a
multi-session retrofit, not a today item).

Ready to start on #5 whenever you say go — one step at a time, verified before moving to the next,
same discipline as the rest of this build.
