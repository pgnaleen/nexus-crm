# Epic 4: Priority Deck — Prototype v2 Visual & Interaction Parity (done — 12/12)

Part of the split epics tracker — see [`../EPICS.md`](../EPICS.md) for the status-source note and
the "Unsorted / Current Focus" cross-cutting items shared across every file in this folder.

Brings Epic 3's functional module (see [`../archive/epics-archive.md`](../archive/epics-archive.md))
up to the client's second working prototype (`orel-tasks_2.html`, 2026-07-28) — richer
visual/interaction treatment of the *same* functionality, not new functionality. Deliberately
introduces blue/purple-adjacent quadrant hues as a documented, scoped exception to the CRM's "no
blue anywhere" rule (see `CLAUDE.md`'s Design System section).

- [x] 2.1 Priority Deck Colour & Type Tokens
- [x] 2.2 Quadrant Panel Chrome — Axes, Numbering, Count, Gradient
- [x] 2.3 Rich Task Card — Accent Rank Chip, Status Pills, Inline Progress
- [x] 2.4 Delegation Tracking Card Parity
- [x] 2.5 Task Detail — Lifecycle Stepper
- [x] 2.6 Task Detail — Segmented 10% Progress Control
- [x] 2.7 Task Detail — History as a Vertical Timeline
- [x] 2.8 Owner-Side Re-delegation of an Accepted Task
- [x] 2.9 Incoming Drawer Parity
- [x] 2.10 Archive Parity — Attribution, Progress Pill, Soft Delete
- [x] 2.11 Action Toasts
- [x] 2.12 Per-Quadrant Empty States

2.10's delete path (soft-delete + cascade of trackers/shares) was verified live against the real
API/DB per `CLAUDE.md`'s cascade-verification rule, 2026-07-28.
