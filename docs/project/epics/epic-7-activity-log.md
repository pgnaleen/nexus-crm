# Epic 7: Activity Log — Audit Trail Visibility & Authentication Events (done — 6/6)

Part of the split epics tracker — see [`../EPICS.md`](../EPICS.md) for the status-source note and
the "Unsorted / Current Focus" cross-cutting items shared across every file in this folder.

> **Status override.** `sprint-status.yaml` (generated 2026-07-31) shows this epic as `backlog`,
> all 6 stories `backlog` — but that predates the work. `spec-activity-log.md`'s own
> "Implementation status (2026-08-03) — built, verified, shipped" section, the standalone
> `activity-log-handoff.md` ("Status: done and verified"), and `CLAUDE.md`'s own already-recorded
> `AUDIT_LOG_VIEW` permission exception (dated 2026-08-03) all independently confirm this shipped.
> Marking done here based on that stronger, more recent evidence.

Makes the `audit_logs` trail (written since early in the project across 23 entity types, never
previously readable) visible via a permission-gated Activity Log page, and closes the
zero-authentication-auditing gap with a new `auth_events` table. Full behavioral spec:
[`../specs/activity-log.md`](../specs/activity-log.md).

- [x] 1.1 Activity Log page on mock data
- [x] 1.2 Permission and navigation (`AUDIT_LOG_VIEW` — single-key exception to the four-permission
  rule, documented in `CLAUDE.md`)
- [x] 1.3 Schema — indexes and the `auth_events` table
- [x] 1.4 Read API — filtered, paginated, tenant-scoped (first server-side pagination in the app)
- [x] 1.5 Wire the page to the API
- [x] 1.6 Record authentication events (login success/failure w/ reason, lockout, logout — IP +
  user agent captured, `TRUST_PROXY_HOPS` added)

**Grew beyond the frozen spec, both by explicit later product-owner request:** cross-tenant
viewing for genuine System-tenant sessions (server-enforced, never client-trusted), and the page
living under Settings → Audits rather than its own sidebar entry.

**Known gap:** `users.service.ts` never got wired to record `password_changed`/`password_reset` as
`auth_events` — only the four `auth.service.ts` login/logout capture points exist. A user's own
password change or an admin reset leaves no trace in Sign-in Activity today.
