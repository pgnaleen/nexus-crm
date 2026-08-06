# Epics & Stories — ORELIA CRM (Nexus CRM)

**Split by epic** into [`epics/`](./epics/) — one file per epic, same pattern as
`api-endpoint-registry.md`'s split into `api/`. This file is the index + progress view + the
cross-cutting items that don't belong to one specific epic.

Status source: `_bmad-output/2-current-work/sprint-status.yaml` (generated 2026-07-31, verified
against code at that time) is the baseline for story status below. Two epics have moved since that
file was generated — **Epic 2** gained two additional stories (1.9, 1.10) and **Epic 7** was fully
built — both confirmed directly against later, dated evidence (implementation notes inside the
epic files themselves, `spec-activity-log.md`'s "Implementation status" section, and
`activity-log-handoff.md`). Each override is called out explicitly in the relevant epic file,
rather than silently trusting either source.

Epic numbers below match `sprint-status.yaml`'s global renumbering (each source epic file calls
itself "Epic 1"; sprint-status assigns 1–7 across all of them). Story numbers inside each epic keep
their original per-file numbering (e.g. Epic 3's stories are still 1.1–1.10 in the source file).

## Index

| Epic | Status | File |
|---|---|---|
| 1 — HR: Employee Directory & Organization Visibility | done — 14/14 core (+2 draft, not built) | [`epics/epic-1-hr.md`](./epics/epic-1-hr.md) |
| 2 — System: UI Modernization & Dashboard | in-progress — 8/10 | [`epics/epic-2-system.md`](./epics/epic-2-system.md) |
| 3 — Priority Tracker: Eisenhower Task Management | done — 10/10, **archived** (superseded by 4 & 5) | [`archive/epics-archive.md`](./archive/epics-archive.md) |
| 4 — Priority Deck: Prototype v2 Visual & Interaction Parity | done — 12/12 | [`epics/epic-4-priority-deck.md`](./epics/epic-4-priority-deck.md) |
| 5 — Priority Tracker: Event-Sourced Flow, Task Chat & Real-Time Sync | done — 5/5 | [`epics/epic-5-realtime-flow.md`](./epics/epic-5-realtime-flow.md) |
| 6 — User Management: Account Provisioning & Credential Lifecycle | in-progress — 1/8 | [`epics/epic-6-user-management.md`](./epics/epic-6-user-management.md) |
| 7 — Activity Log: Audit Trail Visibility & Authentication Events | done — 6/6 | [`epics/epic-7-activity-log.md`](./epics/epic-7-activity-log.md) |
| 8 — Finance: Navigation Shell, Configuration & Financial Management | backlog — 0/10 | [`epics/epic-8-finance.md`](./epics/epic-8-finance.md) |
| 9 — Legal: Contract Management & Configurable Foundations | backlog — 0/10 | [`epics/epic-9-legal.md`](./epics/epic-9-legal.md) |

---

## Unsorted / Current Focus

Items from `_bmad-output/2-current-work/open-items.md` that don't map to one specific story below,
condensed (severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low):

- 🟠 User creation is not transactional — a failed employee link during `POST /users` orphans an
  account with a generated password nobody was emailed, and retrying then 409s on the username.
  `users.service.ts::create()`. No story number; should ship alongside Epic 6.
- 🟠 `typescript.ignoreBuildErrors: true` in `frontend/next.config.js` — production builds cannot
  fail on type errors.
- 🟠 `docker-compose.yml`'s local-`postgres` removal exists only on the deploy server, uncommitted —
  a fresh clone/redeploy hits the same port conflict that caused the 2026-07-22 outage again. See
  `PLANS.md`'s production deployment plan.
- 🟡 Rotate the three secrets (`DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) that were
  printed into a chat transcript during the 2026-07-22 incident diagnosis.
- 🟡 Testing track has never started — Step 0 tooling setup not done, 0 sections tested
  (`_bmad-output/5-testing/`, explicitly dropped from this migration — nothing to carry over).
- 🟡 i18n retrofit incomplete — 17 namespaces exist; Tenants, Roles, Teams, Deal Sources, Main/Sub
  Stages, Funnel, Dashboard, and shared UI primitives still hardcode text.
- 🟡 Upload extension + `ContentType` still come from the client (`splitExt(originalname)`) —
  `uploads.controller.ts`, `storage/s3.service.ts:70`.
- 🟡 `audit_logs` grows unbounded with no retention/purge policy — surfaced by Epic 7, which makes
  the table readable for the first time. Decide the policy (monthly `RANGE` partitioning is the
  recommended shape) before the table gets big, not after.
- 🟡 Audit coverage gaps: `DocumentsService`, `UploadsController`, `IndustriesService`,
  `DbBackupService` write zero audit rows; `CompaniesService`/`ContactsService` write none of their
  own (only the relationship services do). `AuthService`'s half of this is now closed (Epic 7).
- ⚪ Delete the dead `DEAL_STAGES_MANAGE` permission wildcard — zero controllers check it. See
  `PLANS.md`'s funnel/deal-management plan (Task 4).
- ⚪ Per-action row labels in the Roles permissions dialog still show the raw resource-prefix
  suffix instead of a friendly label (`RolePermissionsDialog.tsx`).
- **Dashboard, next phase (2026-08-04 analysis, not yet turned into stories):** two Business-Analyst
  gap-analysis passes (`dashboard-gap-analysis.md`, `dashboard-widgets-by-persona-analysis.md`)
  identified real, buildable gaps against the Story 1.9/1.10 widget-grid architecture that's now the
  confirmed foundation: stage conversion % surfaced visibly, a "Weighted Pipeline" stat card, Partner
  Pipeline value/weighted columns, deal-source win-rate, per-rep breakdown (via
  `deal_role_assignments`), and a full rep-personal widget set ("my pipeline," "my at-risk," "my
  tasks" — reusing already-shipped Priority Tracker data). Admin widgets (sign-in/security activity,
  RBAC hygiene, backup status, data-hygiene reminders for deals owned by a terminated employee) are
  independent of the rest and reuse already-shipped services. Needing a scoping decision first:
  Budget vs Commit vs Pipeline (no quota/target entity exists) and win/loss-reason analysis (no
  `lostReason` column on `Deal`). See these two files' git history for full detail before starting
  this work — not yet broken into numbered stories under Epic 2.
