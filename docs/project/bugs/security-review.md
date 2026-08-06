# Security Review (commit `9fd864f`, 2026-07-20)

Part of the split bugs tracker — see [`../BUGS.md`](../BUGS.md) for the severity legend shared
across every file in this folder. Unresolved unless noted.

- 🟠 `deals.service.ts` create()/update() accept client-supplied `companyId`/`ownerId`/`contactId`/
  `sourceId`/`mainStageId`/`currentStageId` with no cross-tenant ownership check — a tenant-A user
  who knows/guesses a tenant-B UUID can link a deal to it and the response leaks that tenant's
  company/owner name back.
- 🟠 Logo upload lets the stored file extension diverge from the validated MIME type (client-
  supplied `originalname`) — upload `evil.html` typed as `image/png`, it's stored and served as
  live HTML, stored XSS with session cookies attached (compounded by uploads being served
  unauthenticated — see below).
- 🟠 `AddDealDialog` can create duplicate deals when a post-create document upload or contact-link
  call fails — one shared try/catch across the deal create and the follow-up `Promise.all`, so the
  dialog stays open with the same values and resubmitting calls create again.
- 🟠 `CalendarWidget` keys the calendar grid off UTC dates while "today" is computed from local
  time — misplaces reminders by a day for any user ahead of UTC (this org's own timezone) before
  ~05:30 local.
- 🟡 Deal code generation (`DEAL-00001`) has a race condition — `countAllScoped()+1` with no
  transaction/lock and no unique DB constraint; two concurrent creates in the same tenant can
  produce identical codes.
- 🟡 The entire `/uploads` directory is served statically with zero auth or tenant check —
  filenames are random UUIDs (not brute-forceable) but there's no login requirement and no way to
  revoke a leaked URL.
- 🟡 SVG is allow-listed for logo upload and served inline — combined with the static-serving gap
  above, a validly-typed SVG with an embedded `<script>` executes on direct navigation.
- 🟡 `POST /uploads/logo` only requires `RELATIONSHIP_VIEW` (a read permission) for a mutating
  action.
- 🟡 `multer@^1.4.5-lts.1` — the lockfile's own advisory flags 1.x vulnerabilities patched in 2.x,
  which is already present as a transitive dep.
- 🟡 `AddDealDialog` silently skips the required-Sub-Stage validation when the selected Main Stage
  currently has zero Sub Stages, but `currentStageId` is still a required `@IsUUID()` server-side —
  submission hits a generic backend 400 instead of a clear client message.
- 🟡 `CompanyFormDialog`'s edit-mode contact rows POST one-by-one with no rollback tracking — a
  later row failing leaves earlier rows already created server-side; retrying duplicates them.
- 🟡 `CompanyFormDialog` can leave a stale `parentCompanyName` in the DB after switching a company
  to reference a parent by id — the PATCH never explicitly clears the old column.
- ⚪ No magic-byte content sniffing anywhere in the upload pipeline — MIME/extension checks are
  entirely client-supplied.
- ⚪ `uploadDealDocument` bypasses the shared `apiFetch` 401-refresh-retry logic — an expired token
  mid-dialog fails the upload outright.
- ⚪ `AddDealDialog` sends `probability` as a raw `Number()` with no int/step constraint; backend
  DTO requires `@IsInt()` — a decimal passes client-side and only fails with a generic 400.

*Resolved from this same review:* `deal-contacts.service.ts::add()` never validating `contactId`'s
tenant — fixed 2026-07-20 when the module was replaced by `deal-partners.service.ts`, which
resolves every target through the tenant-scoped repository first.
