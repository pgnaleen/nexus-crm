# API Endpoint Registry

A single reference for every backend endpoint in the system — what it is, what it's for, what it
sends/returns, and whether it's been brought up to the current logging standard. The goal is that
someone can understand the shape of the whole API surface without having to open every controller.

**Split by feature area** into [`api/`](./api/) so a session working on one module only has to
open that module's file, not all ~700 lines. Grep the folder for a specific endpoint/module, or
jump straight to the right file from the index below.

**This registry is built up section-by-section as each part of the system gets reviewed** (same
pace as the rest of this project), not filled in all at once for the entire codebase in one pass.
Rows are added the moment an endpoint is created or changed.

## Rule: keep this in sync

**Whenever a backend endpoint is created, moved, renamed, re-gated, or has its request/response
shape changed, update the relevant file in the same change.** This is now a standing rule — see
`CLAUDE.md`. A registry that drifts from the real code is worse than no registry, because it
actively misleads.

## Column legend

- **Type** — `RBAC` (gated on the resource's own `_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE`
  permissions) or `System-Internal (Picker)` (narrow lookup, gated on whatever the *consumer*
  screen holds, never the looked-up resource's own admin permission). See CLAUDE.md's "RBAC
  Routes vs. System-Internal (Picker) Routes".
- **Debug Logging** — ✅ endpoint + its service method(s) follow the "Deep debug logging inside
  every backend endpoint" rule (entry log, a line per branch taken, result-count log, try/catch
  with rethrow). ⬜ means it still needs the retrofit pass. Scan this column to see what's left.

## Index

| Area | File | Modules covered |
|---|---|---|
| Pickers & Auth | [`api/pickers-and-auth.md`](./api/pickers-and-auth.md) | Pickers module, Auth module |
| Deals | [`api/deals.md`](./api/deals.md) | Main/Sub Stages, Deals, Deal Documents/Partners/Roles/Team/Stage History/Activity Log/Notes/Tender Details, Deal Sources |
| Relationships | [`api/relationships.md`](./api/relationships.md) | Relationship Types, Relationship Parties, Relationship Tags |
| HR | [`api/hr.md`](./api/hr.md) | Departments, Employees, Certifications, Teams |
| Admin | [`api/admin.md`](./api/admin.md) | RBAC, Users, Tenants |
| Priority Tasks | [`api/priority-tasks.md`](./api/priority-tasks.md) | Priority Tasks (incl. shares, chat, WebSocket gateway) |
| Platform | [`api/platform.md`](./api/platform.md) | Uploads, Activity Log (audit), Dashboard (incl. Metrics) |
