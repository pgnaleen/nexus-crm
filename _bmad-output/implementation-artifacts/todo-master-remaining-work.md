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

## D. Deferred UX item

**Read-only View-mode for other admin sections' Form dialogs.** Deals already has this
(`ViewDealDialog`). The ~9 other admin sections (Departments, Main Stages, Sub Stages, Deal
Sources, Relationship Types, Teams, Tenants, Users, Roles) still open nothing on row click for a
View-only user — deferred pending the debug-logging/audit-log rollout above, not urgent for
"production ready," but a real gap for any View-only role today.

---

## E. i18n rollout

Not started. Retrofit one section at a time once the actual mechanism (library, file layout,
language-switch plumbing) is decided as its own first step:
Tenants/Roles/Users/Teams → Relationship Types/Deal Sources/Main Stages/Sub Stages/Departments →
Relationships → Employee Management → shared UI primitives' own built-in text.

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
