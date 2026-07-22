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

### 🟡 Medium severity, still open
- `deals.service.ts` deal-code generation (`DEAL-00001`) has no transaction/lock and no unique DB
  constraint — concurrent creates in the same tenant can collide.
- `/uploads` is served fully statically with zero auth/tenant check (`main.ts:20`) — filenames are
  unguessable UUIDs, but there's no login requirement and no way to revoke a leaked URL.
- SVG is allowed in the logo upload allow-list and served inline — embedded `<script>` executes on
  direct navigation (compounds the High XSS item above).
- `POST /uploads/logo` is gated on `RELATIONSHIP_VIEW` (a *view* permission) for a *mutating*
  action — a read-only role can write files.
- `multer@^1.4.5-lts.1` is pinned despite the lockfile's own advisory that 1.x has vulnerabilities
  patched in 2.x (2.x is already present transitively).
- `AddDealDialog`'s required-Sub-Stage validation is skipped when the selected Main Stage has zero
  Sub Stages, even though the backend DTO requires it regardless — hits a generic 400 instead of a
  clear client message.
- `CompanyFormDialog` edit-mode posts new contact rows one-by-one with no rollback tracking —
  a failure partway through duplicates already-created rows on retry.
- `CompanyFormDialog` can leave a stale `parentCompanyName` in the DB after switching to a
  parent-by-ID reference (`undefined` is dropped by `JSON.stringify`, so the old column is never
  cleared server-side).

### ⚪ Low severity, still open
- No magic-byte content sniffing anywhere in the upload pipeline (MIME/extension checks are
  client-supplied only — compounds the High/Medium upload findings above).
- `uploadDealDocument` uses a raw `fetch` (to avoid `apiFetch`'s forced JSON content-type) and so
  loses the shared 401-refresh-retry path — an expired token mid-dialog fails the upload outright.
- `AddDealDialog` sends `probability` as a raw `Number()` with no int/step constraint against the
  backend's `@IsInt()`.
- Misc UI nits: `RolePermissionsDialog`'s prefix-stripping assumes one `:` occurrence; several
  Roles-dialog form controls/inputs have no accessible label; `.permissions-grid`/`.permissions-*`
  CSS blocks use hardcoded hex instead of the shared CSS variables and have no responsive
  breakpoint; `AccountMenu`'s Log out item uses an inline red style that both breaks the shared
  hover rule and over-alarms a reversible action; `RoleFormDialog`'s required marker is cosmetic
  only (no `aria-required`); a stray em-dash character / a stray BOM in two files.

---

## C. Standing infrastructure rollouts (one-time build items, ship module-by-module)

### Deep debug logging retrofit
Reference implementation (entry log, branch-level debug lines, result-count log, full
try/catch+rethrow) is done for: Pickers, Auth (`verify-password`), Relationship Types, Main
Stages/Sub Stages, `deals.service.ts::create/update`, `deal-notes.*`.
**Still missing:** Departments, Deal Sources, Teams, Relationship Parties, RBAC, Users, Tenants,
the rest of Auth, `deals.service.ts::remove/moveStage`, `deal-documents.service.ts`,
`deal-partners.service.ts`, `deal-stage-history.service.ts`.

### `AuditLogService` rollout
Done for: Relationship Types (`create`/`update`/`remove`), `deals.service.ts`
(`create`/`update`), `deal-notes.*` (`create`/`update`).
**Still missing:** `deal-documents.service.ts`/`deal-partners.service.ts` (uploads, deletes,
partner add/remove aren't in the `audit_logs` trail at all), plus the same longer list above
(Departments, Deal Sources, Teams, Relationship Parties, RBAC, Users, Tenants).

### API Endpoint Registry (`api-endpoint-registry.md`)
No sections yet for: Departments, Deal Sources, Teams, Relationship Parties, RBAC, Users,
Tenants, the rest of Auth.

### Enforce `createdBy`/`updatedBy` NOT NULL at the DB level (stretch, explicitly do last)
Only after confirming every service path always sets them (audit via the rollout above) — change
`created_by`/`updated_by` from `nullable: true` to `NOT NULL` via migration. A blind constraint
today would break seed/system rows inserted without a real actor.

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
