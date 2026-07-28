---
stepsCompleted: ['1', '2']
inputDocuments: ['Downloads/Prioiry Deck/OREL_CRM_Task_Management_SOW.docx (client SOW SOW-CRM-TASK-001 v1.0)', 'Downloads/Prioiry Deck/orel-tasks.html (client working prototype v1, reference only)', 'Downloads/Prioiry Deck/orel-tasks_2.html (client working prototype v2, 2026-07-28 — the visual/interaction target for Epic 2)']
---

# Nexus CRM — Priority Tracker Epic Breakdown

## Overview

User stories for the Priority Tracker module (client-facing name: OREL CRM Eisenhower Task
Management Module), decomposed from the client's Statement of Work (`SOW-CRM-TASK-001` v1.0,
sponsor: Hisham, CEO) and its accompanying working prototype (`orel-tasks.html`). Built as a
native, tenant-scoped module inside Nexus CRM — not the SOW's original standalone HTML +
key-value-store prototype. Gated by authentication only, no RBAC permission (same pattern as My
Profile), since every user manages their own personal board. Reviewed and confirmed one story at
a time with the product owner.

## Epic List

1. Priority Tracker — Eisenhower Task Management ✅ built (Stories 1.1–1.10)
2. Priority Deck — Prototype v2 Visual & Interaction Parity — ✅ **all 12 stories built** (2026-07-28)

   2.1 tokens · 2.2 quadrant chrome · 2.3 rich card · 2.4 tracker parity · 2.5 stepper ·
   2.6 segmented progress · 2.7 timeline · 2.8 owner re-delegation · 2.9 incoming drawer ·
   2.10 archive parity · 2.11 toasts · 2.12 per-quadrant empty states.

   Backend touched by **2.3, 2.4, 2.9, 2.10** only — see the build-order table's corrections. The
   remaining eight were presentation-only, per CLAUDE.md's migration discipline.

   **2.10's delete path verified live, 2026-07-28.** Ran against the real API + database, per
   CLAUDE.md's rule that a cascade must be confirmed by querying the leaf row, not assumed:
   created → completed → archived through the real endpoints, then seeded the hazardous state (a
   delegation tracker owned by a *different* user pointing at the archived task, plus a share row)
   and called `DELETE /priority-tasks/:id`. Confirmed: the task row **still exists** with
   `deleted_at` + `deleted_by` set (soft, not hard); tracker and share both cascaded to 0; one
   `audit_logs` delete row carrying `removedDelegationTrackers: 1, removedShares: 1`; the task
   returns 404 and is absent from both the board and archive lists. Separately re-created an
   orphaned tracker by hand and confirmed `GET /delegated-trackers` returns **200 with it skipped**
   (log: "Skipped 1 tracker(s) whose task is gone") — the 500 this story exists to prevent. The
   archived-only guard returns 409 on a live task and leaves its `deleted_at` NULL. All test data
   removed afterwards; zero orphaned trackers remain database-wide.

## Epic 1: Priority Tracker — Eisenhower Task Management

Give every user a personal Eisenhower-matrix command deck to create, prioritise, delegate, track,
and close tasks — from a bare board through full delegation and lifecycle tracking to archive/
restore — as one standalone, complete module, fully auditable from creation to archive.

### Story 1.1: View and Navigate My Priority Board — ⚠️ REOPENED (built; superseded visually by 2.1–2.3, 2.12)

As an **authenticated user**,
I want **to see my tasks laid out across a four-quadrant Eisenhower board**,
So that **I can immediately see what's urgent and important without reading a flat list**.

**Acceptance Criteria:**

**Given** I am logged in
**When** I open the Priority Tracker
**Then** I see four quadrants arranged in a 2x2 grid: Urgent+Important (**DO**), Not Urgent+Important (**DECIDE**), Urgent+Not Important (**DELEGATE**), Not Urgent+Not Important (**DELETE**) — no permission check beyond being authenticated, same as My Profile
**And** each quadrant displays its action word as a large, translucent watermark behind the task cards

**Given** I am logged in
**When** I look at the sidebar
**Then** the Priority Tracker link is always visible — it's not gated behind any resource permission

**Given** tasks exist in a quadrant
**When** I view that quadrant
**Then** tasks are stacked vertically in rank order, numbered continuously starting at 1 at the top

**Given** a task was created by me, versus one shared or delegated to me
**When** I look at it on the board
**Then** the two are visually distinguished (e.g. an "owned" vs "received" badge)

**Given** a quadrant has no tasks yet
**When** I view it
**Then** I see a clear empty state, not a blank or broken-looking area

**Given** I'm viewing the board
**When** I look at each quadrant
**Then** it uses a distinct pastel colour and rounded, soft-shadow card styling, built with this project's Tailwind/FlyonUI utility classes — not new hand-written CSS

**Given** I have zero tasks anywhere yet
**When** I first open the Priority Tracker
**Then** all four quadrants show empty with a friendly first-use empty state, not an error

### Story 1.2: Create a Task — CONFIRMED

As an **authenticated user**,
I want **to create a new task and place it directly into one of the four quadrants**,
So that **I can immediately start tracking something new against its urgency and importance**.

**Acceptance Criteria:**

**Given** I click "New Task" from the board
**When** the create form opens
**Then** I can enter a title (required) and notes (optional), and choose which quadrant to place it in

**Given** I submit the form with a title and a quadrant
**When** it saves
**Then** the task appears at the bottom of that quadrant's stack (next available rank), owned by me, with status **Placed** and progress **0%**

**Given** I try to submit without a title
**When** I submit
**Then** I see a clear inline validation error and nothing is saved

**Given** I click "New Task" from inside a specific quadrant (e.g. the **+** on the DO quadrant)
**When** the form opens
**Then** that quadrant is pre-selected, though I can still change it before saving

**Given** a new task is created
**When** I check who it's attributed to
**Then** I am recorded as both the creator and current owner, and it's marked as not shared/not delegated

**Given** I save a new task successfully
**When** the save completes
**Then** it appears on my board (Story 1.1) immediately, no page reload needed

### Story 1.3: Reprioritise Tasks via Drag-and-Drop — CONFIRMED

As an **authenticated user**,
I want **to drag a task to reorder it within a quadrant or move it to a different quadrant, with a live indicator of where it'll land**,
So that **I can re-prioritise quickly as things change, without deleting and recreating tasks**.

**Acceptance Criteria:**

**Given** I press and drag a task card
**When** I move it over the board
**Then** a drop-target indicator shows exactly where it will land, including between two existing cards — not just at the top or bottom of a quadrant

**Given** I drop a task in a new position
**When** the drop completes
**Then** rank numbers update immediately for every affected task in both the source and destination quadrants, with no duplicate or missing ranks

**Given** I move a task to a different quadrant
**When** it lands there
**Then** it keeps its title, notes, and history — only its quadrant and rank change (ownership and status are untouched)

**Given** I use a touch device
**When** I press and drag a task
**Then** the same reordering and quadrant-move behavior works identically to mouse-based dragging

**Given** I drag a task around the board
**When** I'm mid-drag
**Then** the interaction responds within ~100ms — no lag between my movement and the card/indicator following it

**Given** I drop a task outside any valid quadrant area
**When** I release
**Then** the task snaps back to its original position — no partial or broken state

### Story 1.4: View and Edit Task Details & Notes — ⚠️ REOPENED (built; superseded visually by 2.5, 2.7)

As an **authenticated user**,
I want **to open a task to see its full details and edit its notes**,
So that **I can capture context and updates without cluttering the board view itself**.

**Acceptance Criteria:**

**Given** I click on a task card
**When** the detail view opens
**Then** I see its title, notes, current quadrant, owner, status, progress, and lifecycle history

**Given** I am the current owner of the task
**When** I edit the notes
**Then** I can save changes and they're reflected immediately, both in the detail view and the next time I reopen it

**Given** a task has only been shared with me (visibility only, not delegated)
**When** I open its detail view
**Then** I can read the notes but cannot edit them — editing is reserved for the current owner

**Given** I try to open a task I have no relationship to (not creator, not current owner, not a share/delegation recipient)
**When** I attempt to access it directly
**Then** access is denied — I only ever see tasks I created, own, or have been shared/delegated

**Given** the task has accumulated lifecycle history
**When** I view its detail view
**Then** I see a chronological list of events (e.g. Created, Shared, Delegated, Progress updated) with who did it and when

### Story 1.5: Share a Task with Another User — CONFIRMED

As an **authenticated user**,
I want **to share a task with another user so they can see it, without transferring ownership**,
So that **I can keep someone in the loop without handing off responsibility for the task**.

**Acceptance Criteria:**

**Given** I am the current owner of a task
**When** I open its detail view and choose "Share"
**Then** I can search for and select another user in my tenant to share it with

**Given** I share a task with someone
**When** they check their Incoming panel (Story 1.8)
**Then** the task appears there, marked as **Shared** (visibility only) — they are not the owner, and ownership doesn't change

**Given** a task has been shared with someone
**When** I, the owner, view my own board
**Then** the task still appears there unchanged — sharing doesn't remove it from my board or transfer my ownership

**Given** I share a task
**When** compared to delegating it (Story 1.6)
**Then** the recipient can only view it — the task's quadrant/rank on my board and its ownership stay entirely mine, nothing auto-moves the way delegation does

**Given** a task has only been shared with me (I'm not the owner)
**When** I try to share it onward to someone else
**Then** I can't — only the current owner can share a task

**Given** the same task is shared with multiple users
**When** each recipient views their own Incoming panel
**Then** each sees it independently, and one recipient reading it doesn't affect the others' access

### Story 1.6: Delegate a Task to Another User — CONFIRMED

As an **authenticated user (task owner)**,
I want **to delegate a task to exactly one other user, handing off ownership and having it tracked automatically**,
So that **I can offload work with confidence it won't get lost, and still see how it's progressing**.

**Acceptance Criteria:**

**Given** I am the current owner of a task
**When** I open its detail view and choose "Delegate"
**Then** I can search for and select exactly one other user in my tenant to delegate it to

**Given** I delegate a task to someone
**When** the delegation completes
**Then** the task automatically moves into my own DELEGATE quadrant (regardless of which quadrant it was in before), so I always know what I've handed off

**Given** I delegate a task
**When** the recipient checks their Incoming panel (Story 1.8)
**Then** it appears there flagged as a delegated, important item — distinct from a merely shared item (Story 1.5)

**Given** a task has been delegated to me
**When** I pull it onto my own board (Story 1.8)
**Then** I become its current owner and can place it into whichever quadrant makes sense for me

**Given** I try to delegate a task I don't currently own (e.g. it was only shared with me)
**When** I attempt to delegate it
**Then** I cannot — only the current owner can delegate a task; handing off something already delegated to me is re-delegation (Story 1.8), not a fresh delegation

**Data-model note (flag for architecture, not resolved here):** the SOW's task record has a single `quadrant`/`rank` pair, but delegation needs the delegator's own DELEGATE-quadrant tracking card and the recipient's independently-chosen quadrant (once they accept) to coexist simultaneously. Whether that's modeled as per-perspective placement on one record or a lightweight tracking-card reference is an architecture-stage decision, not something to guess at in this story.

### Story 1.7: Track and Update Delegation Progress — ⚠️ REOPENED (built; superseded visually by 2.3, 2.4, 2.6)

As an **authenticated user**,
I want **to update a delegated task's progress in 10% steps, and have the originator see it update**,
So that **whoever handed off the work always knows how close it is to done, without having to ask**.

**Acceptance Criteria:**

**Given** I am the current owner of a delegated task
**When** I open its detail view
**Then** I see a progress bar I can move in 10% increments, from 0% to 100%

**Given** I update the progress
**When** I save the change
**Then** it's recorded immediately and visible to the originator the next time they view their own tracking card for it

**Given** I am the originator (delegator), not the current owner
**When** I view the task
**Then** I can see the current progress value but cannot change it myself — only the current owner updates it

**Given** the progress reaches 100%
**When** I view the task
**Then** it's marked as ready for closure (a visible "ready to close" indicator), setting up the archive flow (Story 1.10)

**Given** I try to set progress to a value that isn't a multiple of 10%
**When** I attempt it (e.g. via a direct API call, bypassing the UI slider)
**Then** it's rejected — only 0/10/20/…/100 are valid values

### Story 1.8: View and Act on My Incoming Tasks — ⚠️ REOPENED (built; extended by 2.8, 2.9)

As an **authenticated user**,
I want **a single panel showing everything shared or delegated to me**,
So that **I never miss an incoming item buried inside someone else's task**.

**Acceptance Criteria:**

**Given** I open the Incoming panel
**When** it loads
**Then** I see every task currently shared or delegated to me, each clearly labeled as **Shared** or **Delegated**

**Given** an item in my Incoming panel was delegated to me
**When** I choose to accept it
**Then** I select a quadrant to place it into, it appears on my own board there, I become its current owner, and its status advances to **Accepted** / **In Progress**

**Given** an item in my Incoming panel was only shared with me (not delegated)
**When** I view it from the panel
**Then** I can read it, but there's no "pull to board" action for it — ownership never transfers via a share

**Given** an item was delegated to me
**When** I choose to re-delegate it to someone else instead of accepting it myself
**Then** I select a different user and it moves to their Incoming panel as a delegation from me — I do not become the owner in this path, and the original delegator is retained in its history

**Given** my Incoming panel is empty
**When** I open it
**Then** I see a clear empty state, not a blank area

**Given** a task I previously accepted is later re-delegated by me
**When** anyone views its full history
**Then** the whole chain (original delegator → me → my re-delegation target) is visible, not lost

### Story 1.9: Track a Task's Full Lifecycle & Audit History — ⚠️ REOPENED (built; superseded visually by 2.5, 2.7)

As an **authenticated user**,
I want **every task to show its current lifecycle stage and a full history of what happened to it**,
So that **I, and anyone else with visibility, can see exactly how it got to where it is**.

**Acceptance Criteria:**

**Given** a task exists
**When** I view its detail view
**Then** I see its current lifecycle stage: one of Created, Placed, Shared/Delegated, Accepted, In Progress, Completed, or Archived

**Given** a task moves through its lifecycle (created, placed, shared, delegated, accepted, progress updated, completed, archived, restored)
**When** any of these events happens
**Then** a new history entry is recorded with the actor, the event, and a timestamp — visible in the task's detail view in chronological order

> **Amended 2026-07-28 by Story 2.7.** The display order is now **newest first**, not oldest first —
> the most recent thing that happened to a task is the thing you opened it to find. The API is
> unchanged and still returns oldest-first (`audit_logs` ordered `occurredAt ASC`); the reversal is
> presentation-only, on a copy. The entry's *content* also split in two: the event on its own line
> ("Progress 40%"), the actor and time beneath it ("Amara · 3h ago"), rather than one composed
> sentence ("Amara set progress to 40%").

**Given** a task's history is recorded
**When** I check how it's stored
**Then** it uses this project's existing `audit_logs`/`AuditLogService` mechanism (same pattern already used for Relationship Types) — not a bespoke history table built just for tasks

**Given** I mark a task Completed
**When** I check its status
**Then** the lifecycle stage updates to Completed, ready to be archived (Story 1.10)

**Given** I have no relationship to a task (not creator, owner, or a share/delegation recipient)
**When** I try to view its history
**Then** I can't — same access rule as the rest of the detail view (Story 1.4)

### Story 1.10: Archive and Restore Completed Tasks — ⚠️ REOPENED (built; extended by 2.10)

As an **authenticated user**,
I want **to archive a completed or closed task, and restore it later if needed**,
So that **my active board stays focused on what's still in play, without losing anything permanently**.

**Acceptance Criteria:**

**Given** a task is Completed (or a delegated task I own has been closed)
**When** I choose "Archive" on it
**Then** it's removed from my active board and its lifecycle stage becomes Archived

**Given** I open the Archive view
**When** it loads
**Then** I see every task I've archived, with its final status, progress, and full history intact

**Given** I select an archived task
**When** I choose "Restore"
**Then** it returns to my active board, back into the quadrant it was last placed in, with its history preserved (including the archive/restore event itself)

**Given** a task is not yet Completed
**When** I check whether "Archive" is available on it
**Then** it isn't — only Completed (or closed-delegation) tasks can be archived

**Given** my Archive view has nothing in it yet
**When** I open it
**Then** I see a clear empty state, not a blank area

**Given** I archive a task
**When** I check what happens to anyone else it was previously shared/delegated with
**Then** their own view of it is unaffected — archiving is scoped to my own copy/perspective, not a blanket removal for every party (this ties back to the same per-perspective data-model question flagged in Story 1.6, for architecture to resolve)

## Open Questions for Architecture

- **Per-perspective task placement.** Flagged in Stories 1.6 and 1.10: the SOW's task record has one `quadrant`/`rank` pair, but delegation/sharing/archiving all need the delegator's own tracking view and the recipient's independently-chosen placement to coexist without colliding. Needs a concrete data-model decision (per-perspective placement records vs. a lightweight tracking-card concept referencing one canonical task) before Story 1.6 can be built. **Resolved during build** — a separate `priority_task_delegation_trackers` table holds the delegator-side card; the canonical task carries the current owner's own placement.

---

# Epic 2: Priority Deck — Prototype v2 Visual & Interaction Parity

## Context

Epic 1 delivered the full functional module (Stories 1.1–1.10, all built and merged). The client then
produced a second working prototype, `orel-tasks_2.html` (2026-07-28), which is a substantially richer
visual and interaction treatment of the same functionality — not new functionality. This epic brings
the built module up to that prototype.

**Product decisions taken with the sponsor before writing these stories:**

1. **The prototype's visual language is the target.** Its quadrant palettes, card anatomy, stepper,
   timeline, and toasts are what the Priority Deck should look like — this module is a deliberate,
   documented exception to the CRM-wide "no blue anywhere" rule, because the four Eisenhower
   quadrants need four mutually distinguishable colours and the palette is content, not chrome.
2. **Shared ≠ placeable.** The prototype lets a merely-shared task be pulled onto your board. That is
   prototype convenience (it has no ownership boundary — it's a single-user client-side toy). Stories
   1.5 and 1.8's existing rule stands unchanged: **shares are read-only, live only in Incoming, and
   never transfer ownership or take a board placement.** The prototype's "Add to board" button is
   therefore **only** rendered for delegated items, never shared ones.
3. **No hard delete.** The prototype's Archive "Delete" button erases the record. Ours soft-deletes
   (`deletedAt`/`deletedBy` + an `audit_logs` row) behind a confirmation dialog. No password re-entry
   — nothing cascades from a personal task.

## Deliberate divergences from the prototype (NOT stories — do not "fix" these)

| Prototype behaviour | What we do instead | Why |
|---|---|---|
| "Acting as: <user>" dropdown in the top bar | Nothing — the real authenticated session is the actor | The dropdown only exists to simulate multiple users in a single-file demo. Explicitly excluded by the sponsor. |
| Own full-screen top bar (logo, brand, brandmark) | The CRM's existing app shell + a standard page title/subtitle | The Deck is a page inside the CRM, not a standalone app. |
| Board fits the viewport; each quadrant stack scrolls internally | Board grows with content; the page scrolls | Deliberate change made in commit `2020455` so the watermark is never hidden behind a scrolled stack. |
| Dashed insertion line + rotated drag ghost | dnd-kit live reflow: real cards move apart to open the landing slot, with a `DragOverlay` | Same information, conveyed more directly. Already built and working on touch (Story 1.3). |
| Notes autosave on blur | Explicit "Save notes" button, shown only when dirty | Autosave has no error path — a failed PATCH would silently lose the edit. |
| Share = one `<select>` + a Share button | A managed share list with per-recipient unshare | Ours is a strict superset. |
| No per-quadrant add button | A `+` on each quadrant header, which pre-selects that quadrant | Ours is a strict superset (Story 1.2 AC). |
| `localStorage` / in-memory persistence, seeded demo data | Real tenant-scoped API + Postgres | Not a design question. |

---

### Story 2.1: Priority Deck Colour & Type Tokens — DRAFT

As a **developer working on the Priority Deck**,
I want **every Deck-specific colour to exist as a named design token**,
So that **the board can match the prototype exactly without a single raw hex landing in a component**.

**Acceptance Criteria:**

**Given** the Deck needs colours the CRM palette doesn't have
**When** I add them
**Then** they are declared in `frontend/src/app/globals.css`'s existing Tailwind `@theme` block as
`--color-*` custom properties, so Tailwind v4 generates real utility classes for them
(`bg-pd-do-fill`, `text-pd-de-acc`, …) — this is Tailwind v4's configuration mechanism, **not**
hand-written CSS, and no new CSS rule blocks are added

**Given** the four quadrants each need a fill, a soft top-of-gradient, an accent, and a watermark tint
**When** the tokens are declared
**Then** all sixteen exist, named `--color-pd-{do|de|dg|dl}-{fill|soft|acc|word}`, with the
prototype's exact values:

| Quadrant | `-soft` | `-fill` | `-acc` | `-word` |
|---|---|---|---|---|
| `do` (DO) | `#fff1f3` | `#ffe3e8` | `#ff6f87` | `#ffc3cd` |
| `de` (DECIDE) | `#f0f6ff` | `#dfecff` | `#4f8cf6` | `#bcd6ff` |
| `dg` (DELEGATE) | `#fffaeb` | `#fff2d3` | `#e39a1f` | `#ffe1a0` |
| `dl` (DELETE) | `#effbf4` | `#d9f4e6` | `#2fa377` | `#b6e9cf` |

**Given** a component needs one of these colours
**When** I write the markup
**Then** I use the generated Tailwind utility (`bg-pd-do-fill`) or, only where Tailwind can't express
it as a utility (the multi-stop quadrant gradient), `var(--color-pd-do-fill)` inside arbitrary-value
bracket syntax — never a literal hex string in a `.tsx` file (CLAUDE.md single-source-of-truth rule)

**Given** the prototype uses Fredoka for display type and Nunito for body
**When** the Deck renders
**Then** the CRM's existing font stack is used unchanged — **no new webfont is loaded.** Display
weight/size/tracking are matched via Tailwind utilities instead. (Rationale: two extra Google Fonts
on every CRM page for one module is not a trade worth making, and the CRM's stack already renders the
prototype's weights.)

**Given** this module deliberately introduces blue and purple-adjacent hues
**When** the tokens land
**Then** `CLAUDE.md`'s Design System section gains a short note recording the Priority Deck quadrant
palette as an approved, scoped exception to "no blue anywhere" — so it stops being re-flagged on
every review

---

### Story 2.2: Quadrant Panel Chrome — Axes, Numbering, Count, Gradient — DRAFT

As an **authenticated user**,
I want **the board to read as a labelled 2×2 matrix, not four loose panels**,
So that **I can see at a glance which axis makes a quadrant urgent versus important**.

**Acceptance Criteria:**

**Given** I open the Priority Deck
**When** I look above the grid
**Then** I see two column axis labels — **URGENT** over the left column, **NOT URGENT** over the right
— rendered as small, uppercase, wide-tracked muted text, centred over their column

**Given** I look to the left of the grid
**When** I read down
**Then** I see two row axis labels — **IMPORTANT** beside the top row, **NOT IMPORTANT** beside the
bottom row — rotated to read bottom-to-top, in the same muted small-caps treatment

**Given** I look at any quadrant's header
**When** I read it
**Then** it shows, in one line: a filled dot in that quadrant's accent colour (with a soft halo ring),
its quadrant number (**Q1**–**Q4**, bold), its axis name (e.g. "Urgent · Important"), and — pushed to
the right — the **count of cards currently in it**

**Given** a quadrant has a background
**When** I view it
**Then** it's a vertical gradient from that quadrant's `-soft` at the top to its `-fill` at the
bottom, with rounded corners — replacing today's flat single-tone wash

**Given** I look at a quadrant's watermark
**When** cards are stacked in it
**Then** the action word (**DO** / **DECIDE** / **DELEGATE** / **DELETE**) renders bottom-right in
that quadrant's `-word` tint at the prototype's weight and scale, and remains visible — the existing
reserved bottom padding that guarantees this must not be regressed

**Given** the existing per-quadrant `+` button
**When** the header is restyled
**Then** it survives — it sits alongside the new count without crowding it

**Given** every string added here (axis labels, quadrant numbers, axis names)
**When** it's rendered
**Then** it comes from the `priorityTracker` namespace in `en.json`, never a hardcoded literal

---

### Story 2.3: Rich Task Card — Accent Rank Chip, Status Pills, Inline Progress — DRAFT

As an **authenticated user**,
I want **each card to tell me its rank, its relationship to me, and its progress without opening it**,
So that **I can triage the whole board in one pass instead of clicking into every task**.

**Acceptance Criteria:**

**Given** a card is rendered in a quadrant
**When** I look at its left edge
**Then** its rank is a **rounded-square chip filled with that quadrant's accent colour, white bold
numeral**, with a soft coloured drop shadow — replacing today's grey circle

**Given** a card has a relationship to me
**When** I look at its pill row (directly under the title)
**Then** exactly the applicable pills render, each with its own colour pairing:

| Condition | Pill | Colour pairing |
|---|---|---|
| I created it, never delegated it out | `✦ Mine` | violet tint / violet text |
| I own it but someone else created it (I accepted a delegation) | `↩ Assigned to me` | pink tint / pink text |
| I delegated it out and am tracking it | `→ {name}`, plus ` · pending` while unaccepted | amber tint / amber text |
| It was shared with me by someone else | `👁 Shared by {name}` | blue tint / blue text |
| I own it and have shared it with others | `👁 Shared` | blue tint / blue text |
| It has non-empty notes | `📝 Note` | neutral grey tint |
| Its status is Completed | `✓ Done` | green tint / green text |

**Given** a card's title is longer than one line
**When** it renders
**Then** it wraps (up to the card's natural height) rather than truncating with an ellipsis — the
prototype wraps, today's implementation truncates

**Given** a task is delegated, or has any progress recorded
**When** I look at its card
**Then** a slim inline progress bar renders under the pills — an amber gradient fill on a light track,
with the percentage as a small bold numeral to its right — animating on change

**Given** a task has no delegation and zero progress
**When** I look at its card
**Then** no progress bar renders (an empty bar on every card is noise)

**Given** I look at a card's right edge
**When** it's openable
**Then** a muted `›` chevron indicates it can be opened, vertically centred

**Given** I hover a card
**When** the pointer is over it
**Then** it lifts by 1px and its shadow deepens; the `cursor: grab` drag affordance is unchanged

**Given** I drag a card
**When** it's mid-drag
**Then** the source card dims to ~35% opacity and the drag overlay renders the full card — pills,
progress bar and all — not a stripped-down version

---

### Story 2.4: Delegation Tracking Card Parity — DRAFT

As an **authenticated user who has delegated work out**,
I want **my tracking cards to look and behave like real cards**,
So that **the DELEGATE quadrant reads as a live dashboard, not a list of greyed-out stubs**.

**Acceptance Criteria:**

**Given** I delegated a task and it sits in my DELEGATE quadrant
**When** I look at its tracking card
**Then** it renders with the same anatomy as a normal card (Story 2.3) — accent rank chip, solid white
surface, full shadow — **not** today's dashed-border, rank-less, translucent stub

**Given** I look at a tracking card's pills
**When** the delegation is still unaccepted
**Then** it shows `→ {recipient} · pending`; once accepted, the ` · pending` suffix drops

**Given** the recipient updates progress on a task I delegated
**When** I next load my board
**Then** my tracking card's inline progress bar reflects their current percentage — it is live-joined
to the real task, never a frozen snapshot (already true in the API; this story surfaces it)

**Given** I click a tracking card
**When** it opens
**Then** the task detail dialog opens in **delegator/read-only mode**: I can read title, notes, status,
progress and full history, but I cannot edit notes or move the progress control (Story 1.7's rule —
only the current owner updates progress)

**Given** I drag a tracking card to a different quadrant
**When** I release
**Then** it snaps back to DELEGATE — a tracking card is a reference to a delegation, not a placement I
own, so it cannot leave that quadrant (this matches the prototype's `drag.isTrack` behaviour)

---

### Story 2.5: Task Detail — Lifecycle Stepper — DRAFT

As an **authenticated user**,
I want **a visual stepper showing where a task is in its lifecycle**,
So that **I can see its stage at a glance instead of reading a status word**.

**Acceptance Criteria:**

**Given** I open a task's detail view
**When** I look below the header
**Then** I see a horizontal 7-step stepper: **Created → Placed → Delegated → Accepted → In progress →
Completed → Archived**, each step a numbered dot with a caption beneath it, joined by a connector rail

**Given** the task has passed a step
**When** the stepper renders
**Then** that step's dot is green with a `✓`, and the rail leading into it is green

**Given** the task is currently at a step
**When** the stepper renders
**Then** that step's dot is filled in the accent colour with its number, and its caption is in full-
strength text; every later step is grey with a muted caption

**Given** the stage must be determined
**When** the frontend derives it
**Then** it derives from the existing `PriorityTaskStatus` enum plus `progress`, with **no new enum
value and no migration** — `archived` → 6, `completed` or `progress ≥ 100` → 5, `progress > 0` → 4,
`accepted` → 3, `delegated` → 2, otherwise → 1. ("Created" is step 0 and is always already passed;
creation and placement are the same event in our data model.)

**Given** every step caption
**When** it renders
**Then** it comes from `en.json`, not a hardcoded array of English strings

---

### Story 2.6: Task Detail — Segmented 10% Progress Control — DRAFT

As an **authenticated user who owns a delegated task**,
I want **to set progress by clicking one of ten blocks**,
So that **the 10%-step rule is obvious from the control itself rather than enforced invisibly**.

**Acceptance Criteria:**

**Given** I am the current owner of a task and it has been delegated to me
**When** I look at the progress control
**Then** I see **ten discrete blocks** in a row, filled left-to-right with the amber gradient up to the
current value, with the percentage shown large and bold to the right — replacing today's native
`<input type="range">` slider

**Given** I click the *n*-th block
**When** the click registers
**Then** progress is set to *n* × 10%, persisted via the existing `PATCH /priority-tasks/:id/progress`,
and the control re-renders from the server's response

**Given** I click the block that already represents the current value
**When** the click registers
**Then** progress steps **down** by 10% (so the control can be walked backwards without a separate
control) — this is the prototype's toggle behaviour

**Given** I am not the current owner (I'm the delegator, or it was merely shared with me)
**When** I look at the control
**Then** the blocks render at the current value but are not clickable and carry no hover affordance —
Story 1.7's rule is unchanged

**Given** progress reaches 100%
**When** the control re-renders
**Then** the existing "ready to close" indicator still appears (Story 1.7 AC), and a short hint below
the blocks explains the 10%-step / 100%-closes behaviour

**Given** the 10%-step rule
**When** anything calls the API directly with a non-multiple of 10
**Then** the backend still rejects it — this story changes the control, never the validation

---

### Story 2.7: Task Detail — History as a Vertical Timeline — DRAFT

As an **authenticated user**,
I want **a task's history drawn as a connected timeline**,
So that **I can read the chain of events as a sequence rather than a stack of identical rows**.

**Acceptance Criteria:**

**Given** a task has history entries
**When** I view them in the detail dialog
**Then** each entry renders as a dot on a vertical rail, with the event description in bold and the
actor + relative time beneath it in muted small text — replacing today's list of bordered boxes

**Given** two or more entries exist
**When** they render
**Then** a thin connector line joins each dot to the next; the last entry has no trailing line

**Given** I look at an entry's timestamp
**When** it's recent
**Then** it shows as a relative time ("just now", "14m ago", "3h ago"); past 24 hours it falls back to
an absolute date + time, matching the prototype's `fmt()` behaviour

**Given** the entries are ordered
**When** the timeline renders
**Then** **newest first** (the prototype reverses the array) — note this reverses today's chronological
order, so Story 1.9's AC wording is amended accordingly

**Given** the history source
**When** it loads
**Then** it still comes from the existing `GET /priority-tasks/:id/history` derived from `audit_logs` —
no bespoke history table, no API change (Story 1.9's rule)

---

### Story 2.8: Owner-Side Re-delegation of an Accepted Task — DRAFT

As an **authenticated user who currently owns a task delegated to me**,
I want **to hand it onward after I've already accepted it**,
So that **I'm not forced to decide at the moment it arrives, before I understand the work**.

**Acceptance Criteria:**

**Given** I am the current owner of a task that was delegated to me and I have accepted it
**When** I open its detail view
**Then** a **"Re-delegate"** action is available in the footer, alongside Complete and Archive

**Given** I choose Re-delegate and pick a user
**When** it saves
**Then** the task leaves my active board, moves into my own **DELEGATE** quadrant as a tracking card,
and appears in the target user's Incoming panel as a delegation from me

**Given** I re-delegate a task
**When** anyone later views its history
**Then** the full chain is intact — original creator → original delegator → me → my target — with no
link lost (Story 1.8's chain-of-custody AC, now reachable from the owner side too)

**Given** I created a task myself and never received it from anyone
**When** I open its detail view
**Then** I see **"Delegate"**, not "Re-delegate" — the two are the same operation with different
wording, chosen by whether `createdBy` is me

**Given** a task was merely shared with me
**When** I open it
**Then** neither Delegate nor Re-delegate is available — Story 1.5's rule, unchanged

**Note (resolved at build time, 2026-07-28):** this note originally guessed that
`POST /priority-tasks/:id/redelegate` was the endpoint to use, and that its guard might need widening.
Both halves were wrong, and the right answer needs no backend change at all:

- `redelegate()` guards on `task.delegatedToUserId === userId` — strictly the *pending recipient*. An
  accepted owner has `delegatedToUserId = null`, so it 404s them. **Correct as-is; do not widen it.**
  It is a genuinely different operation: it re-points a still-pending delegation and deliberately does
  *not* create a tracking card, because the original delegator's tracker already covers the task.
- `POST /priority-tasks/:id/delegate` already does exactly what this story needs. It guards on
  `ownerId` (an accepted owner qualifies), rejects an already-pending delegation, resequences the old
  quadrant, sets `status`/`delegatedToUserId`/`delegatedByUserId`, **and creates the re-delegator's own
  tracking card** — which is AC 2 verbatim.

So this story is **frontend-only**: the same endpoint, with the button relabelled by `isCreator`.

**Known cosmetic consequence:** a re-delegation through `delegate()` writes an audit row with a status
change, so `mapAuditRow` classifies it `kind: "delegated"` and the timeline reads "Delegated to X"
rather than "Re-delegated to X". The *chain* is fully intact (every hop recorded with its own actor),
which is what AC 3 actually requires — only the label is less specific. Distinguishing them would mean
writing an extra marker into the audit `changes` payload; not worth a backend change for one word.

---

### Story 2.9: Incoming Drawer Parity — DRAFT

As an **authenticated user**,
I want **each incoming item to show what it is, who it's from, and what it says before I act**,
So that **I can accept or pass work on without opening each one first**.

**Acceptance Criteria:**

**Given** I open the Incoming drawer
**When** an item renders
**Then** it carries a **4px coloured left bar** identifying its kind — amber for a delegation, blue for
a share — in addition to the existing text badge

**Given** an incoming item has notes
**When** it renders
**Then** the first ~80 characters of the notes preview beneath the "from" line, prefixed with a note
glyph and ellipsised if longer

**Given** an incoming item of either kind
**When** I look at its actions
**Then** an **"Open"** action is present, which opens the full task detail dialog read-only — today
there is no way to inspect an incoming item before acting on it

**Given** the item was **delegated** to me
**When** I choose "Add to board"
**Then** a dedicated modal opens with the four quadrants as **selectable visual tiles** (accent dot,
action word, axis name) rather than today's inline dropdown; picking one and confirming accepts the
delegation into that quadrant

**Given** the item was merely **shared** with me
**When** I look at its actions
**Then** only "Open" is available — **no "Add to board", no "Re-delegate"**. This deliberately diverges
from the prototype, which offers "Add to board" on shares; Stories 1.5/1.8's read-only rule stands

**Given** the drawer's header
**When** items are waiting
**Then** the subtitle reads "{n} waiting for you", falling back to the static description at zero — and
the board button's existing count badge continues to track it

**Given** the drawer is empty
**When** I open it
**Then** the existing empty state is kept and restyled to the prototype's centred glyph + two-line
treatment

---

### Story 2.10: Archive Parity — Attribution, Progress Pill, Soft Delete — DRAFT

As an **authenticated user**,
I want **the Archive to show me what each task was and let me clear out ones I'll never restore**,
So that **the archive stays a useful record rather than an ever-growing pile**.

**Acceptance Criteria:**

**Given** I open the Archive
**When** a row renders
**Then** it shows a green `✓ {n}%` pill on the left, the title, and beneath it an attribution line —
"by {creator}", plus " · via {current owner}" when the task passed through a delegation

**Given** an archived task
**When** I look at its actions
**Then** both **Restore** and **Delete** are present, with Delete in the danger red

**Given** I choose Delete
**When** the action fires
**Then** a confirmation dialog appears first, naming the task and stating the removal is permanent from
my view; no password re-entry is required (nothing cascades from a personal task)

**Given** I confirm the delete
**When** it saves
**Then** the row is **soft-deleted** — `deletedAt` and `deletedBy` are set, an `audit_logs` row is
written via `AuditLogService`, and the record remains in the table. It disappears from the Archive and
from every other view. **No hard `DELETE` is issued**, diverging from the prototype's `deleteForever`

**Given** a task I delete was previously shared or delegated to someone else
**When** they view their own copy
**Then** their view is unaffected — deletion is scoped to my own perspective, the same rule Story 1.10
already established for archiving

**Given** the new endpoint
**When** it's added
**Then** it follows the deep-debug-logging standard (class `Logger`, entry/branch/exit lines, try/catch
+ rethrow) and is added to `api-endpoint-registry.md` in the same change

---

### Story 2.11: Action Toasts — DRAFT

As an **authenticated user**,
I want **a brief confirmation after each action**,
So that **I know a delegation or share actually landed without hunting for the change on screen**.

**Acceptance Criteria:**

**Given** I complete an action that changes task state
**When** it succeeds
**Then** a toast appears briefly at the bottom-centre of the screen, auto-dismissing after ~2.2s,
non-blocking and non-interactive

**Given** the specific action
**When** the toast renders
**Then** its message is action-specific and names the target, e.g. "Task added to DO",
"Shared with {name}", "Delegated to {name} — tracking in DELEGATE", "Re-delegated to {name}",
"Task completed", "Moved to archive", "Restored", "Deleted"

**Given** an action fails
**When** the error surfaces
**Then** the **existing** error-alert path is used, not a toast — toasts are for confirmations only, so
a failure can never be missed by looking away for two seconds

**Given** the CRM may already have a toast primitive
**When** this is built
**Then** the existing shared component is reused if one exists; a new one is only added if it doesn't,
and if added it lives in `components/ui/` for the whole app, not inside the Deck's `_components/`

**Given** every toast string
**When** it renders
**Then** it comes from `en.json` with `{name}`/`{quadrant}` interpolation, never string concatenation

---

### Story 2.12: Per-Quadrant Empty States — DRAFT

As an **authenticated user**,
I want **an empty quadrant to tell me what belongs there**,
So that **a blank DELEGATE panel reads as "nothing delegated yet" rather than "something is broken"**.

**Acceptance Criteria:**

**Given** a quadrant has no cards
**When** I look at it
**Then** I see a centred glyph above a single line of muted text, vertically centred in the panel —
replacing today's identical two-line message in all four quadrants

**Given** the empty quadrant is **DELEGATE**
**When** it renders
**Then** its message is specific to delegation ("Delegated tasks appear here"), not the generic
drop-or-add prompt — the other three read "Drop or add a task"

**Given** each quadrant's glyph
**When** it renders
**Then** it is distinct per quadrant, matching the prototype's mapping (DO ⚡, DECIDE 🗓️, DELEGATE 🤝,
DELETE 🧹), at reduced opacity so it reads as a hint rather than content

**Given** I have zero tasks anywhere
**When** I first open the Deck
**Then** all four quadrants show their own empty state — Story 1.1's first-use AC is preserved, not
replaced by a single board-level empty screen

**Given** every empty-state string
**When** it renders
**Then** it comes from `en.json` under `priorityTracker.emptyState.{quadrant}`

---

## Epic 2 build order

Strictly sequential — each depends on the one before it landing first:

| # | Story | Depends on | Touches |
|---|---|---|---|
| 1 | 2.1 Colour & type tokens | — | `globals.css`, `CLAUDE.md` |
| 2 | 2.2 Quadrant chrome | 2.1 | `PriorityBoard.tsx`, `types.ts`, `en.json` |
| 3 | 2.3 Rich task card | 2.1 | `PriorityBoard.tsx`, `en.json`, **+ backend** (see note) |
| 4 | 2.4 Tracking card parity | 2.3 | `PriorityBoard.tsx`, `TaskDetailDialog.tsx`, **+ backend** (see note) |
| 5 | 2.5 Lifecycle stepper | — | `TaskDetailDialog.tsx`, `en.json` |
| 6 | 2.6 Segmented progress | 2.1 | `TaskDetailDialog.tsx`, `en.json` |
| 7 | 2.7 History timeline | — | `TaskDetailDialog.tsx`, `en.json` |
| 8 | 2.8 Owner re-delegation | 2.7 | `TaskDetailDialog.tsx`, `en.json` — **frontend only**, see the story's note |
| 9 | 2.9 Incoming parity | 2.5, 2.8 | `IncomingPanelDialog.tsx`, `AcceptTaskDialog.tsx`, `types.ts`, `SidePanel.tsx`, `en.json`, **+ backend** (see note) |
| 10 | 2.10 Archive parity | — | `ArchivePanelDialog.tsx`, service + controller, migration?, registry |
| 11 | 2.11 Toasts | — | shared `components/ui/`, all four Deck components |
| 12 | 2.12 Empty states | 2.1 | `PriorityBoard.tsx`, `en.json` |

**Correction (found while building 2.3):** this table originally claimed only 2.8 and 2.10 touch the
backend. That was wrong. **2.3 needs two additive read-only fields on `PriorityTaskResponse`** that no
endpoint returned:

- `isCreator: boolean` — the "Mine" vs "Assigned to me" pill needs createdBy-vs-viewer, an axis the
  existing `ownership` field (ownerId-vs-viewer) structurally cannot express: a task I created and a
  task I accepted from someone else are both `"owned"`.
- `shareCount: number` — the "Shared" pill needs to know the owner has shared it, which nothing on the
  board response carried.

Neither changes an existing field, a route, or any validation.

**Second correction (found while building 2.4):** that story also needed backend work, for a real
bug rather than a cosmetic one. `accept()` transfers `ownerId` to the acceptor, so once a delegation
was accepted the delegator was neither owner nor share-recipient and `findOneForUser` **404'd them
out of their own tracking card**. And before acceptance the opposite failure applied: the delegator
is still `ownerId`, so the detail dialog — which gated everything on `ownership === "owned"` — gave
them full edit rights over work they had already handed off. Fixed by admitting tracker-holders to
`findOneForUser` (read-only) and adding a `canEdit: boolean` to the response for the UI to gate on.
No mutation path was widened.

**Third correction (found while building 2.8):** that story turned out to need **no** backend change
at all — see its own note. The `redelegate` guard should stay exactly as narrow as it is.

**Fourth correction (found while building 2.9):** that story needed backend work too, for both of the
ACs that go beyond styling. `IncomingTaskResponse` carried **no notes field**, so the preview (AC 2)
had nothing to render — added as `notes: string | null`. And the "Open" action (AC 3) was impossible:
a **pending delegation recipient** is not the owner, not a share recipient, and holds no tracker, so
`findOneForUser` 404'd them out of an item sitting in their own Incoming panel. Admitted them
read-only, the third widening of that method in this epic — each for a genuinely distinct party
(share recipient in 1.5, delegator-tracker in 2.4, pending delegate in 2.9). `canEdit` is false for
all of them and no mutation path was widened.

Net: **2.3, 2.4, 2.9 and 2.10 touch the backend**; the other eight stories are presentation only and, per
CLAUDE.md's migration discipline, must not alter API calls, routes, validation, submit handlers,
state management, or data mapping/sorting/filtering.

**Also found while building 2.3:** Story 2.1's ACs only enumerated the sixteen quadrant tokens, but
the card needs fifteen more (six pill bg/fg pairs, two progress-bar colours, one chevron). They were
added to the same `@theme` block on the same terms — 2.1's rule ("every Deck colour is a named token,
no raw hex in a component") held; only its inventory was short.
