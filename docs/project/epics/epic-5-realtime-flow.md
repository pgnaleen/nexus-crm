# Epic 5: Priority Tracker — Event-Sourced Flow, Task Chat & Real-Time Sync (done — 5/5)

Part of the split epics tracker — see [`../EPICS.md`](../EPICS.md) for the status-source note and
the "Unsorted / Current Focus" cross-cutting items shared across every file in this folder.

Fixes a confirmed duplicate-tracking-card bug by replacing `priority_tasks`' mutable
`owner_id`/`quadrant`/`rank`/`status` columns and the whole `priority_task_delegation_trackers`
table with one append-only `priority_task_flow` table (invariant: at most one `is_current` row per
`(task_id, user_id)`, enforced at the DB level). Adds real per-task chat
(`priority_task_messages`) and the app's first WebSocket infrastructure
(`backend/src/core/realtime/`).

- [x] 3.1 Event-Sourced Flow Table & Migration
- [x] 3.2 Backend Cutover — Rebuild Task Lifecycle on Flow
- [x] 3.3 Task Chat — Send and Read Messages
- [x] 3.4 Real-Time Sync — Board, Incoming & Delegation Live Updates
- [x] 3.5 Real-Time Sync — Live Chat Delivery

All five verified live with real signed JWTs and real `socket.io-client` connections against the
running dev backend/DB, not just reasoned about from the code (2026-07-29).
