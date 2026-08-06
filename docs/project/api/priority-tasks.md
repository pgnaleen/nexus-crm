# API Endpoint Registry — Priority Tasks

Part of the split registry — see [`../api-endpoint-registry.md`](../api-endpoint-registry.md) for
the sync rule and column legend shared across every file in this folder.

---

## Priority Tasks (`backend/src/modules/priority-tasks/priority-tasks.controller.ts`)

**Superseded by Epic 3 (in `EPICS.md`'s numbering), 2026-07-29 — read this before the history
below.** Stories 3.1/3.2 replaced `priority_tasks.owner_id`/`quadrant`/`rank`/`status`/`progress`/
`delegated_to_user_id`/`delegated_by_user_id` and the whole `priority_task_delegation_trackers`
table (both **dropped**) with one append-only `priority_task_flow` table — every mention of those
columns/that table in the Epic 1/2 notes below is now historical, describing the mechanism at the
time each story was built, not the current schema. **No request/response shape changed**
(`PriorityTaskResponse` etc. are byte-identical) — this was a storage rewrite, verified live by
reproducing the exact bug it fixes (a task delegated in a loop leaving a stale duplicate tracker
behind) against the real dev DB. See `EPICS.md`'s Epic 5 for the full verification evidence. The
history below is kept for context on *why* each endpoint's access rules/validation are what they
are — that reasoning didn't change, only where the state lives.

New module, 2026-07-23/24 — Priority Tracker epic (Eisenhower task board), Stories 1.1 (View/
Navigate board), 1.2 (Create a Task), 1.3 (Drag-and-drop reorder), 1.4 (View/Edit Task Details &
Notes), 1.5 (Share a Task), and 1.6 (Delegate a Task — send-side only, see below). Every story's
frontend was built mock-first (local React state, no backend) and signed off in the browser before
its backend piece was written, per `feature-development-guideline.md`. No `PermissionsGuard`/
`RequirePermission` anywhere in any controller in this module — gated by the global
`JwtAuthGuard` only, same pattern as `POST /users/me/change-password`, since every user manages
only their own personal board (the epic's own explicit "gated by authentication only" decision).
`ownerId` is the one domain-specific actor column on `priority_tasks`; `createdBy` (from
`AuditedTenantEntity`) is who originally created it, resolved to a name for the detail view's
"Created by" history entry. `ownership` (`"owned" | "received"`) is derived per-request as
`ownerId === viewer's own id` — **not** `createdBy === ownerId` (fixed 2026-07-24 while building
Share: sharing never moves `ownerId`, so a shared recipient must see "received" even though the
task's real owner never changed).

**`PriorityTaskResponse` gained two fields, 2026-07-28 (Epic 2, Story 2.3 — rich task card).** Both
are additive and read-only; no existing field, route, or validation changed, so every row below that
returns `PriorityTaskResponse` (#1, #2, #3, #4, #5, #9, and the accept/redelegate/progress/complete/
archive/restore/archived endpoints) now returns them too:

- **`isCreator: boolean`** — `createdBy === viewer's own id`. This is the axis `ownership`
  structurally cannot express: `ownership` is ownerId-vs-viewer, so a task I created and a task I
  accepted from someone else are *both* `"owned"`. The card's "Mine" vs "Assigned to me" pill needs
  to tell those apart. Resolved from the already-loaded entity — no extra query.
- **`canEdit: boolean`** (added 2026-07-28, Story 2.4) — `ownerId === viewer && delegated_to_user_id
  IS NULL`. **Not** the same question as `ownership === "owned"`: ownership only transfers on accept,
  so between delegating and the recipient accepting, the delegator is still `ownerId` while having
  handed the work off. Without this the delegator's own tracking card opened with full edit controls
  (notes, progress, share, complete, archive) on work that was no longer theirs. This is purely a
  response hint for the UI — every mutation was, and remains, gated server-side by
  `findOneOwnedOrFail`, which this does not touch.
- **`shareCount: number`** — how many people the owner has shared the task with, driving the card's
  "Shared" pill. Always `0` for a non-owning viewer (only an owner can share). The two **list**
  endpoints (`GET /priority-tasks`, `GET /priority-tasks/archived`) batch this through
  `countSharesByTaskIds` — one grouped query for the whole board, not one per card. Every
  single-task endpoint lets `toResponse` resolve it with a single indexed `count`, deliberately
  rather than defaulting to `0`: shipping a stale zero would silently drop the "Shared" pill off a
  card straight after an unrelated edit. `toResponse` became `async` for this.

**`IncomingTaskResponse` gained `notes: string | null`, 2026-07-28 (Story 2.9).** Additive; the drawer
shows a ~80-character preview so an item can be triaged without opening it. Sent in full and truncated
client-side — the recipient is either the pending delegate or a share recipient, so they can open the
task and read all of it anyway, and truncating server-side would bake a UI decision into the contract
for no benefit.

`priority_task_shares` is a bare join table (`backend/src/modules/priority-tasks/priority-task-
shares.controller.ts`, routed under `/priority-tasks/:taskId/shares`) — same shape/rationale as
`deal_partners_map`: no `tenant_id` of its own (scoped via the parent task), no soft-delete (a share
is either present or hard-removed by its own "unshare" action). Every method in that controller is
owner-only underneath, enforced in the service, not just a route-level gate.

**Delegation's data-model decision (Story 1.6), resolved 2026-07-24:** rather than restructuring
`priority_tasks` for per-perspective placement, delegation uses a lightweight **tracking-card**
table, `priority_task_delegation_trackers` — the delegator's own read-only breadcrumb, living in
their DELEGATE quadrant, referencing the real task by id and live-joining its title/status/progress
(never a duplicate/frozen snapshot). The real task itself keeps its existing single-owner/single-
quadrant shape untouched: `delegate()` sets `priority_tasks.status = 'delegated'` and
`delegated_to_user_id` (pending pointer), and removes the task from the delegator's own board
(`findAllForUser` now excludes any row with `delegated_to_user_id` set — the tracker represents it
instead). **Only the send-side is built.** Accepting a delegation (transferring `ownerId` to the
recipient, clearing `delegated_to_user_id`) is Story 1.8's job — until that exists, a delegated
task is only ever visible via the delegator's own tracking card, with no way for the recipient to
see or act on it yet (same "real backend, no receiving-side UI" shape Story 1.5 shipped in first).

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/priority-tasks` | Any authenticated user (no RBAC permission) | none | List the caller's own tasks (every quadrant), ordered by rank. | none | `PriorityTaskResponse[]` | `findAll` → `priority-tasks.service.ts::findAllForUser` | `lib/priority-tasks/server.ts::listPriorityTasks` — `/priority` page's initial server-side load only; the board updates client-side by appending the POST response directly, so there's no client-side re-fetch consumer yet | ✅ | `ownership` is always `"owned"` here, since this endpoint only ever returns tasks the caller owns — shared-with-me tasks don't appear on the board (Story 1.8's Incoming panel is where those surface). `createdByName` is `undefined` here — only resolved by #3 below, since nothing on the board itself displays a creator name. |
| 2 | POST | `/priority-tasks` | Any authenticated user (no RBAC permission) | Create a task in one quadrant, landing at the bottom of that quadrant's stack. | body: `{title, notes?, quadrant}` | `PriorityTaskResponse` | `create` → `priority-tasks.service.ts::create` | `lib/api/priority-tasks.ts::createPriorityTask` — `CreateTaskDialog.tsx` | ✅ | `rank` is server-computed (`current max rank in (ownerId, quadrant) + 1`, plain read-then-write, no lock — same low-contention-tolerance as `deals.service.ts`'s `dealCode` counter). `ownerId`/`createdBy` both set to the caller; `status` always `"placed"`, `progress` always `0`. Records an `audit_logs` insert (`entityType: "priority_task"`). |
| 3 | GET | `/priority-tasks/:id` | Any authenticated user (no RBAC permission) | Fetch one task's full detail, including the resolved `createdByName`. | none | `PriorityTaskResponse` | `findOne` → `priority-tasks.service.ts::findOneForUser` + `getUserDisplayName` | `lib/api/priority-tasks.ts::getPriorityTask` — `TaskDetailDialog.tsx` (fetches fresh on open, doesn't trust the board's cached copy) | ✅ | **2026-07-24 (Story 1.5):** access rule broadened from owner-only to owner **OR** anyone the task is shared with (checked against `priority_task_shares`). **2026-07-28 (Story 2.4):** broadened again to also admit a **delegator holding a tracking card** for the task (checked against `priority_task_delegation_trackers.delegator_id`), and **(Story 2.9)** a **pending delegation recipient** (`delegated_to_user_id === caller`) — until they accept they are none of owner/share-recipient/tracker-holder, so they were 404'd out of an item sitting in their own Incoming panel and could not read it before deciding to accept or pass it on — once the recipient accepts, `ownerId` transfers away and the delegator was neither owner nor share-recipient, so they got a 404 opening their own tracking card. Read-only for them (`canEdit: false`); no mutation path was widened — the only method in this module that admits a non-owner, and read-only even then. Still **404, not 403**, for neither (matches this codebase's other tenant/ownership-scoped `findOneOrFail` conventions; never leak that a task exists). |
| 4 | PATCH | `/priority-tasks/:id` | Any authenticated user (no RBAC permission) | Edit a task's notes — the only field Story 1.4 lets the owner change (quadrant/rank belong to Story 1.3's move endpoint below, progress to Story 1.7). | body: `{notes?}` | `PriorityTaskResponse` | `update` → `priority-tasks.service.ts::updateNotes` (now via the shared `findOneOwnedOrFail` helper) | `lib/api/priority-tasks.ts::updatePriorityTask` — `TaskDetailDialog.tsx`'s Save Notes button | ✅ | Owner-only, enforced independently of #3's broader read access (not just a client-side UI gate) — a shared (non-owning) recipient can read via #3 but must never reach this method. No `audit_logs` entry — deliberately deferred to Story 1.9 like the move endpoint below, not bolted on ad hoc. |
| 5 | PATCH | `/priority-tasks/:id/move` | Any authenticated user (no RBAC permission) | Move a task to a (possibly new) quadrant at a specific 0-based position (Story 1.3, drag-and-drop). | body: `{quadrant, index}` | `PriorityTaskResponse` | `move` → `priority-tasks.service.ts::move` | `lib/api/priority-tasks.ts::movePriorityTask` — `PriorityBoard.tsx`'s `onDragEnd`, with optimistic apply + rollback-on-failure | ✅ | Runs in one DB transaction: resequences ranks (1..N, no gaps/duplicates) for every quadrant actually touched, not just the destination. No `audit_logs` entry — see #4's note; a reorder that can fire many times a minute isn't the place to improvise Story 1.9's real lifecycle-history design. |
| 6 | GET | `/priority-tasks/:taskId/shares` | Any authenticated user (no RBAC permission) | List who a task is currently shared with (Story 1.5). | none | `PriorityTaskShareResponse[]` → `{id, userId, displayName, createdAt}[]` | `priority-task-shares.controller.ts::findAll` → `priority-task-shares.service.ts::findAll` | `lib/api/priority-tasks.ts::listPriorityTaskShares` — `TaskDetailDialog.tsx` (owner view only) | ✅ | Owner-only (via `PriorityTasksService.findOneOwnedOrFail`) — a shared recipient can read the task itself (#3) but not who else it's shared with. `displayName` comes from the real `sharedWithUser` relation (a genuine FK, unlike `createdByName` elsewhere in this module, which is a bare-uuid lookup by design). |
| 7 | POST | `/priority-tasks/:taskId/shares` | Any authenticated user (no RBAC permission) | Share a task with another active user in the tenant (Story 1.5). | body: `{userId}` | `PriorityTaskShareResponse` | `priority-task-shares.controller.ts::create` → `priority-task-shares.service.ts::add` | `lib/api/priority-tasks.ts::createPriorityTaskShare` — `ShareTaskDialog.tsx` | ✅ | Owner-only. Validates `userId` via `UsersService.findOneOrFail` (tenant-scoped) before inserting, so an owner can't share with a uuid from outside the tenant. `409 Conflict` if already shared with that person (`UQ_priority_task_shares_task_user`). Records an `audit_logs` insert (`entityType: "priority_task_share"`). |
| 8 | DELETE | `/priority-tasks/:taskId/shares/:shareId` | Any authenticated user (no RBAC permission) | Un-share a task (Story 1.5). | none | `{success: true}` | `priority-task-shares.controller.ts::remove` → `priority-task-shares.service.ts::remove` | `lib/api/priority-tasks.ts::removePriorityTaskShare` — `TaskDetailDialog.tsx`'s remove-share button, optimistic with rollback-on-failure | ✅ | Owner-only. Hard delete (no soft-delete column on this table at all — see the module-level note above). Records an `audit_logs` delete entry. |
| 9 | POST | `/priority-tasks/:id/delegate` | Any authenticated user (no RBAC permission) | Delegate a task to exactly one other active user (Story 1.6, send-side). | body: `{userId}` | `PriorityTaskResponse` | `delegate` → `priority-tasks.service.ts::delegate` | `lib/api/priority-tasks.ts::delegatePriorityTask` — `PriorityBoard.tsx`'s `handleTaskDelegated`, called from `TaskDetailDialog.tsx`'s Delegate button via `DelegateTaskDialog.tsx` | ✅ | Owner-only. One DB transaction: resequences the task's old quadrant (same pattern as `move`), sets `status: 'delegated'` + `delegated_to_user_id`, creates the delegator's tracking card. `409 Conflict` if already delegated (pending), `400` for self-delegation or a non-active target. Records an `audit_logs` update (`entityType: "priority_task"`, noting the status/delegatedTo transition). |
| 10 | GET | `/priority-tasks/delegated-trackers` | Any authenticated user (no RBAC permission) | List the caller's own delegation tracking cards, for the DELEGATE quadrant (Story 1.6). | none | `PriorityTaskDelegationTrackerResponse[]` → `{id, taskId, taskTitle, taskStatus, taskProgress, delegatedToUserId, delegatedToName, rank, createdAt}[]` | `findDelegationTrackers` → `priority-tasks.service.ts::findDelegationTrackersForUser` | `lib/priority-tasks/server.ts::listPriorityTaskDelegationTrackers` (initial load) + `lib/api/priority-tasks.ts::listPriorityTaskDelegationTrackers` (re-fetched client-side right after a successful delegate) — `PriorityBoard.tsx` | ✅ | Declared **before** `:id` in the controller so `delegated-trackers` isn't swallowed as a route param (same fix as `GET /deals/partner-links`). `taskTitle`/`taskStatus`/`taskProgress` are live-joined from the referenced task on every call, never frozen at delegation time. |
| 11 | DELETE | `/priority-tasks/:id` | Any authenticated user (no RBAC permission) | Permanently clear an archived task out of the Archive (Story 2.10). | none | `{success: true}` | `remove` -> `priority-tasks.service.ts::remove` | `lib/api/priority-tasks.ts::deletePriorityTask` -- `ArchivePanelDialog.tsx`, behind a `useConfirm()` destructive confirmation | OK | **Soft delete, never a hard `DELETE`** -- `softRemove()` then `update(id, {deletedBy})`, the same two-step `deals.service.ts::remove` uses (`softRemove` sets `deletedAt` but not `deletedBy`). Owner-only via `findOneOwnedOrFail`, and **409 unless `status === archived`**: a live task can be pending-delegation or shared, and soft-deleting one would yank it out of another user's Incoming panel -- exactly the cross-user side effect Story 1.10's "archiving is scoped to my own perspective" rule exists to prevent. **Epic 3 update:** the cascade now force-flips `is_current = false` on every `priority_task_flow` row for the task (never hard-deleted -- flow rows are never removed, only superseded, so history survives as long as the task row does) instead of hard-deleting `priority_task_delegation_trackers` rows (that table no longer exists); `priority_task_shares` is still hard-deleted, unchanged. Records one `audit_logs` delete row carrying the title/quadrant/status/progress snapshot plus the closed-flow-row and removed-share counts. No password re-entry: CLAUDE.md requires that for *cascading* deletes, and nothing cascades to a real leaf entity here. |

`priority_task_messages` is a second bare join table (Epic 3, Story 3.3, 2026-07-29 — task chat),
routed under `/priority-tasks/:taskId/messages`, same shape/rationale as `priority_task_shares`: no
`tenant_id` of its own (scoped via the parent task), no soft-delete. Unlike a share, a message is
also **immutable once sent** — no edit/delete endpoint in this pass, so it carries no `updated_at`
either. Access is the **broader** `findOneForUser` rule (owner, current tracker-holder, share
recipient, *or pending delegate*) on both read and write, not the owner-only rule shares/mutations
elsewhere in this module use — anyone with any relationship to the task can take part in its
discussion, including a delegation recipient who hasn't accepted yet. Verified live against two real
tenant users (a pending, not-yet-accepted delegate posting successfully) and a third user in a
different tenant entirely, confirmed denied on both read and post with a 404 (not a leaked-existence
403), per this module's existing convention.

| 12 | GET | `/priority-tasks/:taskId/messages` | Any authenticated user (no RBAC permission) | List a task's chat thread, oldest first (Story 3.3). | none | `PriorityTaskMessageResponse[]` → `{id, userId, authorName, body, createdAt}[]` | `priority-task-messages.controller.ts::findAll` → `priority-task-messages.service.ts::findAll` | `lib/api/priority-tasks.ts::listPriorityTaskMessages` — `TaskDetailDialog.tsx`'s chat section | ✅ | Gated by `PriorityTasksService.findOneForUser`, not owner-only. `authorName` resolved via one batched lookup per distinct author (`Promise.all` over a `Set` of ids), not one query per message. |
| 13 | POST | `/priority-tasks/:taskId/messages` | Any authenticated user (no RBAC permission) | Post a message to a task's chat thread (Story 3.3). | body: `{body}` (1–4000 chars, required) | `PriorityTaskMessageResponse` | `priority-task-messages.controller.ts::create` → `priority-task-messages.service.ts::add` | `lib/api/priority-tasks.ts::createPriorityTaskMessage` — `TaskDetailDialog.tsx`'s chat send button | ✅ | Same access rule as #12. `seq` is server-computed per task (`MAX(seq) + 1` inside the write transaction) for stable ordering independent of clock skew. Records an `audit_logs` insert (`entityType: "priority_task_message"`). |

**WebSocket gateway (Epic 3, Story 3.4, 2026-07-29) — the app's first, not just this module's.**
Not a REST endpoint, so it doesn't fit the table above, but it's part of this module's surface:
`backend/src/core/realtime/` (`RealtimeGateway`, `RealtimeService`), registered in the already-global
`CoreModule`, reachable by any authenticated socket, any module. Auth happens by hand on
`handleConnection` — no `@nestjs/passport` guard runs on a socket connection the way `JwtAuthGuard`
runs on every HTTP request — verifying the same `JWT_ACCESS_SECRET`-signed token the HTTP API already
uses, read from the same httpOnly cookie (`auth.token` handshake field as a fallback). Each socket
joins a `tenant:{tenantId}:user:{userId}` room; nothing is ever broadcast wider than that. CORS
mirrors `main.ts`'s own `CORS_ORIGIN` allow-list. Single in-process Socket.IO adapter — the backend
runs as one instance (confirmed via `docker-compose.yml`); add a Redis adapter first if that changes.

`PriorityTasksService` fires `priority-task:flow-changed` (payload: `{taskId}`, a "go re-fetch"
signal, never a snapshot to render directly) after create/delegate/accept/redelegate/move/complete/
archive/restore, to every current flow row's `user_id` plus any `linked_user_id`. Verified live:
signed real JWTs for two real users, connected two real `socket.io-client` sockets to the running
dev backend, drove the real HTTP API end to end, and confirmed both the owner's and the pending
recipient's sockets received exactly the expected events — not asserted from reading the code.

**`priority-task:message` (Epic 3, Story 3.5, 2026-07-29).** Unlike `flow-changed`, this one carries
the real message content (`{taskId, message: {id, userId, authorName, body, createdAt}}`) rather than
a "go re-fetch" signal — a chat message is small, immutable once sent, and has no access-control
re-derivation the way task state does, so pushing it directly is safe and lower-latency.
`PriorityTaskMessagesService.add()` fires it, via a new `PriorityTasksService.getAccessibleUserIds
(taskId)` helper that reuses `findOneForUser`'s exact access rule (holder/tracker-holder/pending-
delegate/share-recipient) rather than re-deriving it in a different shape, to every one of those
users, **including the sender** (their other open tabs/devices need it too — the frontend dedupes by
message id, since the sender's own tab already appended it from the synchronous HTTP response).
Verified live with a third real user in a **different tenant entirely**: a pending, not-yet-accepted
delegate posted a message, and the delegator's socket received it, the sender's own socket received
it back, and the unrelated third user's socket received nothing at all.
