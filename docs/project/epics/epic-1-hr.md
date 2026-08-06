# Epic 1: HR — Employee Directory & Organization Visibility (done — 14/14 core stories)

Part of the split epics tracker — see [`../EPICS.md`](../EPICS.md) for the status-source note and
the "Unsorted / Current Focus" cross-cutting items shared across every file in this folder.

Give HR and management a real, permission-gated system of record for internal staff, plus a visual
org-chart view derived from that same data.

- [x] 1.1 View Employee Directory
- [x] 1.2 Create Employee Record
- [x] 1.3 View Employee Details
- [x] 1.4 Update Employee Record
- [x] 1.5 Deactivate (Exit) or Delete an Employee Record
- [x] 1.6 Grant Login Access to an Employee (from User Management)
- [x] 1.7 View the Organization Chart
- [x] 1.8 Restructure the Org Chart as a Playground
- [x] 1.9 Navigate a Large Org Chart
- [x] 1.10 Export the Org Chart as an Image
- [x] 1.11 View My Own Employee Details on My Profile
- [x] 1.12 Self-Report a Certification
- [x] 1.13 HR Verifies or Rejects a Claimed Certification
- [x] 1.14 Find Certified Employees for Project Staffing

**Added 2026-08-04, not yet built — draft, pending architecture review before implementation:**
- [ ] 1.15 Configurable Reporting Types & Multi-Line Reporting (draft) — admin-defined Reporting
  Types (Direct/Functional/Dotted-line etc.), one primary + any number of secondary/overlay manager
  links per employee. Open questions for the architect: schema shape (new
  `employee_reporting_links` join table replacing `reportingManagerId`), migration/backfill,
  cascade rules on exit/deactivation, and whether secondary links need cycle-detection too.
- [ ] 1.16 Org Chart — Visual, Interaction & Motion Polish (draft) — whole-page design pass (view
  mode + Playground), no acceptance criteria written yet; recommended a UX pass before implementation.

**Deferred (not scheduled):** certification expiry logic (auto-flag/exclude/renew), manager-level
certification verification (currently HR-only via `EMPLOYEES_VERIFY_CERTIFICATIONS`), real-time
multi-user org-chart collaboration.
