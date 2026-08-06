# Archived Epics

Epics moved out of [`../EPICS.md`](../EPICS.md) once fully done AND no longer actively useful in
the live view (typically: superseded by a later epic that covers the same ground). Recoverable via
git history regardless — this file exists so a *current* "what's done / what's next" read of
`EPICS.md` doesn't have to scroll past epics nobody needs day-to-day anymore. See `../README.md`
for the archiving rule.

---

## Epic 3: Priority Tracker — Eisenhower Task Management (done — 10/10)

*Archived 2026-08-06 — fully superseded by Epic 4 (visual/interaction parity) and Epic 5
(event-sourced rewrite), both still live in `EPICS.md`. Kept here rather than deleted since Epic
4/5 are additive on top of this epic's original backend, not a rebuild from scratch — this is the
story list for that original build.*

Personal Eisenhower-matrix command deck: create, prioritise, delegate, track, and close tasks, from
a bare board through full delegation/lifecycle tracking to archive/restore. Gated by authentication
only, no RBAC permission (same pattern as My Profile).

- [x] 1.1 View and Navigate My Priority Board
- [x] 1.2 Create a Task
- [x] 1.3 Reprioritise Tasks via Drag-and-Drop
- [x] 1.4 View and Edit Task Details & Notes
- [x] 1.5 Share a Task with Another User
- [x] 1.6 Delegate a Task to Another User
- [x] 1.7 Track and Update Delegation Progress
- [x] 1.8 View and Act on My Incoming Tasks
- [x] 1.9 Track a Task's Full Lifecycle & Audit History
- [x] 1.10 Archive and Restore Completed Tasks

All 10 stories visually superseded by Epic 4's redesign and functionally superseded by Epic 5's
event-sourced rewrite — both are additive on top of this epic's working backend, not a rebuild from
scratch.
