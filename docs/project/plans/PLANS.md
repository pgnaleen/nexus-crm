# Active Plans & Open Design Questions — ORELIA CRM

Condensed from `_bmad-output/4-design-plans/*.md` (10 files) — **only the plans with genuinely
unresolved work are here.** Seven of the ten described work that's already shipped and were
verified directly against the current codebase before being dropped; each has a one-line pointer
under its relevant story in `EPICS.md` where useful, and the originals are recoverable from git
history:

- `plan-company-contact-edit-delete.md` — shipped (`CompanyFormDialog`'s Existing Contacts list has
  working edit/delete).
- `plan-deal-customer-partner-filtering.md` + `plan-multi-type-system-role.md` — shipped
  (`relationship_types.system_role`, multi-type union pickers, `findSystemRoleTypeIds` confirmed in
  code).
- `plan-delete-guards-deal-dependents.md` — shipped (`countActiveDeals`-style guards confirmed in
  `deal-sources.service.ts`, `departments.service.ts`, `employees.service.ts`).
- `plan-phase6-responsive-qa.md` — shipped (confirmed directly in code: `flex-wrap` in `TopBar.tsx`,
  `overflow-x-auto` on table widgets).
- `plan-relationships-view-mode.md` — shipped (`mode: "view"` confirmed in `CompanyFormDialog.tsx`/
  `ContactFormDialog.tsx`).
- `plan-sidebar-collapse.md` — shipped (`manualOverride`/`isNarrow` state confirmed in
  `Sidebar.tsx`).

---

## 1. Cross-Tab Session Sync — Refresh Race + Identity Switch Fix

Source: `plan-auth-cross-tab-session-sync.md`. Both fixes are **built** (typecheck-verified) but,
per `open-items.md` item 11, **neither has ever been live-verified** — the environment they were
built in had no running DB/server.

- **Fix A (backend, refresh-token race)** — two callers presenting the same refresh-token cookie
  near-simultaneously (two tabs, or `middleware.ts`/`client.ts` racing) used to have one succeed
  and one hard-401 a live session. Fix: a 10-second grace window (`graceToken`/`graceExpiresAt` on
  the rotated-out `refresh_tokens` row) returns the same new token to both racing callers.
  **Explicit accepted tradeoff:** a valid refresh token sits in the DB in *plaintext* (not hashed)
  for up to 10 seconds after rotation — the one deliberate exception to this app's hash-everything
  posture.
- **Fix B (frontend, identity switch)** — cookies aren't tab-scoped, so logging in as a different
  user in one tab silently overwrites every other open tab's session with no signal. Fix: a
  `BroadcastChannel("orelia-auth")` announces login/logout; every other tab does a silent
  `window.location.reload()` (confirmed UX: no toast, matches the Slack/GitHub pattern).

**Still to do:** run both live-verification passes from the plan's §6 execution order —
(1) reproduce the actual race with two near-simultaneous `POST /auth/refresh` calls and confirm
both get the identical token, confirm reuse past 10s still 401s, confirm a normal single caller is
unaffected; (2) two real tabs, log in as a different user in one and confirm the other reloads to
the new session, log out in one and confirm the other reloads to login.

**Explicitly out of scope for this plan:** reuse-detection/theft response (a rotated-out token
reused *after* the grace window is just a normal 401 today — some systems treat late reuse as a
compromise signal and revoke the whole token family; deferred by user decision) and true
multi-account support (independent sessions per tab).

---

## 2. Funnel (Deal Management) — Remaining Tasks

Source: `plan-funnel-deal-management.md`. Most of this 8-task plan has shipped since it was
written — View Deal dialog, i18n mechanism, Add-Deal backend wiring (Deal Country/Pain
Point/Product/Services/Costing fields, Deal Roles/Deal Team for Pre-Sales/PMO), and the Deal
Activity Log (Task 8) are all confirmed built in the current codebase. **Two tasks remain open,
confirmed by direct search — no matching code exists yet:**

- **Task 4, remaining half — delete the dead `DEAL_STAGES_MANAGE` permission.** Confirmed by direct
  query at plan-writing time: exactly `Admin` and `Super Admin` hold `deal_stages:manage`, and grep
  across the entire backend shows zero controllers ever check it. Nothing to migrate *to* — this is
  pure cleanup: unassign from both roles, delete the key from `permissions.ts`, remove its
  `rbac_resources` row. (The first half of Task 4 — wiring `DEALS_STAGE_UPDATE` onto the move
  endpoint — needs re-checking; not confirmed either way.) Referenced from `CLAUDE.md`'s Permission
  Model section and `BUGS.md`.
- **Task 5 — Main Stage / Sub Stage picker endpoints.** Confirmed by direct search: no
  `main-stages/picker` or `sub-stages/picker` route exists anywhere in `backend/src`. The Funnel
  board's tabs/columns still populate from the full admin-gated `GET /main-stages`/`GET
  /sub-stages` list endpoints — a user with `DEALS_VIEW` but not the Main-Stage/Sub-Stage *admin*
  permissions gets a 403 and the board simply doesn't render its columns for them. Fix: mirror
  `departments.controller.ts`'s existing `/departments/picker` pattern (name-only response, gated
  on `DEALS_READ`), consolidate the fetch calls into `frontend/src/lib/pickers/server.ts`.

**Task 6 (deal auto-placement on create)'s architect recommendation** — enforce "every Main Stage
has ≥1 Sub Stage" at the admin level (Option B) rather than making `currentStageId` nullable
(Option A) — was never confirmed as actually implemented; re-verify before treating it as settled.

---

## 3. Production Deployment Hardening

Source: `plan-production-deployment.md`. Written after the 2026-07-22 login outage (root cause: the
`.env` `DB_PASSWORD` didn't match the actual Postgres role password — full postmortem retained in
the original plan's git history, not repeated here since the fix itself is simple and already
applied). The plan's core finding: **there is currently exactly one environment** — same box, same
branch (`dev-g`), same containers, for both daily development and the live client. Every phase
exists to separate those two concerns.

**Structural risks still standing, confirmed as of the plan's writing:**
- Postgres is not part of this app's own stack — it runs inside `goldbond-postgres`, a container
  belonging to an unrelated project sharing the same EC2 host. This app's DB availability is
  coupled to a system it doesn't own or control the maintenance schedule of. This was the root
  enabler of the 2026-07-22 incident.
- Backend runs from `Dockerfile.dev` (`pnpm dev`, hot-reload) in production, not a real production
  build.
- Deploy is entirely manual, over SSH, no CI/CD, no staging environment, no automated rollback, no
  confirmed database backup, everything on `dev-g` — every commit is one deploy away from the
  client with no deliberate promotion step.
- TLS cert is missing its intermediate CA chain — explicitly out of scope for this plan, owned by
  someone else.

**Phase 0 (must-do, cheap, no new infra) — status not re-confirmed since the plan was written:**
1. Cut a `main` branch; point the deploy script at it instead of `dev-g`. *(Blocked — needs GitHub
   repo admin/owner access the plan's author didn't hold; see open item below.)*
2. Tag every deploy (`git tag deploy-YYYY-MM-DD-HHmm`) for one-command rollback.
3. Add a post-deploy smoke test (curl `/api/auth/login`, fail loudly on unexpected status) — this
   single control would have caught the 2026-07-22 incident automatically.
4. Write down the two-sided-secret rule in the deploy runbook: any credential shared between
   `.env` and an external system gets changed on both sides in the same action, verified with a
   real request before considering it done.
5. Nightly `pg_dump` backup of this app's database specifically, stored off-box — and an actual
   test restore into a scratch DB, not just a scheduled job nobody's verified.
6. Agree and communicate a deploy window with the client.

**Phase 1 (environment separation, this-week scope):** a second docker-compose stack on the same
box, separate ports/`.env`/`nexus_crm_staging` database. Branch flow `dev-g` → `staging` (deploy,
verify) → `main` (deploy to prod).

**Phase 2 (remove manual-step error sources):** GitHub Actions CI/CD, real multi-stage production
Dockerfiles (replacing `Dockerfile.dev`), near-zero-downtime container swap.

**Phase 3 (hardening, as capacity allows):** dedicated Postgres for this app (the actual structural
fix for the whole incident category), a formalized/repeated restore-test procedure, basic uptime
monitoring, real secrets management (AWS SSM or a `rotate-db-password.sh` that changes the DB
password/`.env`/restarts the backend as one atomic action).

**Open item needing someone else's access:** GitHub branch protection / `main` branch creation
(Phase 0, item 1) needs repo admin rights not currently held by whoever picks this up.

---

## 4. Configurable Per-Company Approval Workflows (Camunda) — Pending Supervisor Approval

Source: `plan-camunda-approval-workflows.md`. Proposal to let each tenant company define its own
approval process (branching, parallel approval, timer-based escalation) via a self-serve, embedded
BPMN designer, backed by a self-hosted Camunda 8 (Zeebe) engine — tenant-scoped, headless (no
Camunda UI exposed directly), integrated through the existing RBAC/audit-log conventions. First use
case: optional per-tenant approval gate on Deal stage transitions (`deals.service.ts::moveStage`).

**Open item blocking Phase 1:** Camunda's self-managed license terms for embedding inside a resold
product haven't been confirmed yet — needs verification before any infra work starts.

Asking for approval on Phase 0 (license check) + Phase 1 (throwaway prototype) only, not the full
build — see the source plan for the full phased breakdown, pros/cons, and architecture diagrams.
A separate, unrelated recommendation (adopt **n8n** for external-system integrations, e.g. Slack/
accounting notifications on deal events) is noted in the same source plan but isn't part of this
ask.
