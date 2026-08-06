# Bugs & Known Issues — ORELIA CRM

**Split by category** into [`bugs/`](./bugs/), same pattern as `EPICS.md`'s split into `epics/`
and `api-endpoint-registry.md`'s split into `api/`. This file is the index + the shared severity
legend.

Originally condensed from `_bmad-output/2-current-work/deferred-work.md` (code-review findings,
previously auto-appended by a review skill on every run — that auto-append mechanism is retired
with BMAD; from now on, review findings that aren't fixed immediately get added here manually) and
`_bmad-output/6-finished-archive/bugs-user-provisioning.md` (an architecture review's fix list for
Epic 6).

**Severity:** 🔴 critical (security/data integrity) · 🟠 high · 🟡 medium · ⚪ low.

## Open

| Category | File | Count |
|---|---|---|
| User provisioning & credential lifecycle (Epic 6) | [`bugs/user-provisioning.md`](./bugs/user-provisioning.md) | 11 |
| Security review (commit `9fd864f`, 2026-07-20) | [`bugs/security-review.md`](./bugs/security-review.md) | 14 |
| Relationship Tags Tab review (2026-07-31) | [`bugs/relationship-tags-review.md`](./bugs/relationship-tags-review.md) | 6 |
| Roles / Permission dialog review | [`bugs/roles-permissions-review.md`](./bugs/roles-permissions-review.md) | 8 |
| Priority Tracker code review (2026-07-24) | [`bugs/priority-tracker-review.md`](./bugs/priority-tracker-review.md) | 10 |

## Fixed / Closed

[`bugs/fixed-closed.md`](./bugs/fixed-closed.md) — once that list grows enough to crowd out a
quick read, move older entries to [`archive/bugs-archive.md`](./archive/bugs-archive.md).
