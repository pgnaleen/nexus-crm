# Activity Log feature — handoff (2026-08-03)

**Status: done and verified.** This doc is a session summary for whoever picks up the repo next —
the authoritative living docs are [spec-activity-log.md](../3-feature-specs/spec-activity-log.md)
(now `status: implemented`, with a full "Implementation status" section at the bottom covering
deviations, known gaps, and exactly what was verified) and
[api-endpoint-registry.md](./api-endpoint-registry.md) (the "Activity Log" section, three routes).
This file exists so you don't have to reconstruct the story from commit messages alone.

## What it is

A permission-gated Activity Log page (System Administration → **Settings → Audits** tab, next to
the pre-existing Backups tab) with two sub-tabs:

- **Record Changes** — the existing `audit_logs` table (which has been silently recorded since
  early in the project but was never readable by anyone) made visible: filterable by date range,
  actor, module, free-text search; server-side paginated; a renderer turns raw `changes` JSON into
  a readable sentence per row, with a raw-JSON fallback.
- **Sign-in Activity** — a **new** `auth_events` table, capturing login-succeeded, login-failed
  (with reason: unknown user / inactive / bad password / locked out), account-locked, and logout,
  each with the real client IP and user-agent.

Gated on a single new permission, `AUDIT_LOG_VIEW` — a deliberate one-key exception to this
project's normal four-permission (`_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE`) rule, since audit data has
no create/update/delete action of its own. Documented in `CLAUDE.md` and
`feature-development-guideline.md`.

## The two things that grew beyond the original spec, mid-build

Both were explicit product-owner asks partway through, not scope creep — both are now written up
properly in spec-activity-log.md's "Implementation status" section, not just left as a surprise in
the diff:

1. **Cross-tenant viewing for the System tenant.** The frozen spec said "own tenant only, no
   cross-tenant view in v1." A genuine System-tenant session (never act-as-tenant) now sees every
   tenant's activity by default, or one tenant at a time via a Tenant filter — enforced
   server-side (`ActivityLogService.applyTenantScope`), never trusting a client-sent flag.
   Verified live in both directions, including confirming a non-platform user **cannot** widen
   its own scope by sending the same query params.
2. **Settings consolidation.** Instead of its own sidebar entry, this page lives as a tab under a
   renamed "Settings" item alongside the pre-existing Backups tab — again, an explicit instruction
   partway through, not the original plan.

## Security-sensitive detail worth knowing about

`audit_logs.changes` sometimes contains a full DTO spread — e.g. an employee insert's audit row
holds NIC/passport/salary in plain JSON, because the service that wrote it just logged
`{...dto}`. This is redacted **server-side**, before the row ever leaves the API:

- `password`/`passwordHash`/tokens/secrets — always redacted, no matter who's asking.
- `nicPassportNumber`/`baseSalary` — redacted unless the *viewer* (not the original actor) also
  holds `EMPLOYEES_VIEW_SENSITIVE`, mirroring the exact same check `EmployeesController` already
  uses.

Verified live both ways (see spec doc for the exact commands/results).

## Known gaps — not done, worth a follow-up

- `users.service.ts` never got wired to record `password_changed`/`password_reset` auth events —
  only the four `auth.service.ts` login/logout capture points exist. A user's own password change
  or an admin-triggered reset leaves no trace in Sign-in Activity today.
- No retention/purge job for `audit_logs` (tracked separately as open-items.md item #24 — was
  already known and deliberately deferred before this feature, not a new gap it introduced).
- No browser/Playwright verification was possible in this environment (no browser tool available)
  — verified instead via direct HTTP against the real endpoints for every filter, pagination,
  redaction, and cross-tenant case. If you have browser access, a manual click-through of both
  tabs plus every filter combination is the one thing this feature hasn't had that everything else
  in this repo normally gets per `feature-development-guideline.md` §4.

## Where the commits are

```
cd630f0  feat(activity-log): mock-first UI for the Activity Log page
ed074c2  refactor(activity-log): consolidate into Settings tabs + cross-tenant view
67ce7cb  style(frontend): redesign and modernize deal, customer views, settings, and layout components
         ^ the real backend (auth_events table, ActivityLogService/Controller/Module,
           AuthEventService, auth.service.ts login/logout capture wiring) is IN this commit,
           even though the message doesn't mention it — it was committed directly by the human
           developer alongside unrelated frontend restyling while this session was mid-verification
           of that same backend work. Check this commit's file list if you're looking for it.
67114d5  feat(activity-log): wire Activity Log UI to the real backend + docs
         ^ replaced the mock-first frontend with real calls to the three endpoints, deleted
           mock-data.ts, updated CLAUDE.md / feature-development-guideline.md /
           api-endpoint-registry.md.
```

## Unrelated: other work-in-progress you'll see in this repo right now

While finishing this feature, three **unrelated** in-progress features were found sitting
uncommitted in the working tree (deal team roles/`deal_role_assignments`, Main Stage
weight-percent for a Weighted Pipeline KPI, and an FX-rates provider for cross-currency
dashboard KPIs) — none of it built by this session, and at least one file (`AddDealDialog.tsx`)
was still being actively edited elsewhere while this session ran. That work is **not** covered by
this doc; if a `sales-pipeline-dashboard-handoff.md` exists alongside this file, that's the one
describing it. One thing worth knowing regardless: as of this session, the frontend did **not**
typecheck cleanly because of that other work (`AddDealDialog.tsx`/`ViewDealDialog.tsx` still
referenced fields — `ownerId`, `preSalesPersonId`, `pmoId` — that had already been removed from
`DealResponse`) — check `pnpm exec tsc --noEmit` in `frontend/` before assuming a clean build.
