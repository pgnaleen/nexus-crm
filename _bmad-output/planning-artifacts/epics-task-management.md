---
stepsCompleted: ['1', '2']
inputDocuments: ['Downloads/Prioiry Deck/OREL_CRM_Task_Management_SOW.docx (client SOW SOW-CRM-TASK-001 v1.0)', 'Downloads/Prioiry Deck/orel-tasks.html (client working prototype, reference only)']
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

1. Priority Tracker — Eisenhower Task Management

## Epic 1: Priority Tracker — Eisenhower Task Management

Give every user a personal Eisenhower-matrix command deck to create, prioritise, delegate, track,
and close tasks — from a bare board through full delegation and lifecycle tracking to archive/
restore — as one standalone, complete module, fully auditable from creation to archive.

### Story 1.1: View and Navigate My Priority Board — CONFIRMED

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

### Story 1.4: View and Edit Task Details & Notes — CONFIRMED

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

### Story 1.7: Track and Update Delegation Progress — CONFIRMED

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

### Story 1.8: View and Act on My Incoming Tasks — CONFIRMED

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

### Story 1.9: Track a Task's Full Lifecycle & Audit History — CONFIRMED

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

**Given** a task's history is recorded
**When** I check how it's stored
**Then** it uses this project's existing `audit_logs`/`AuditLogService` mechanism (same pattern already used for Relationship Types) — not a bespoke history table built just for tasks

**Given** I mark a task Completed
**When** I check its status
**Then** the lifecycle stage updates to Completed, ready to be archived (Story 1.10)

**Given** I have no relationship to a task (not creator, owner, or a share/delegation recipient)
**When** I try to view its history
**Then** I can't — same access rule as the rest of the detail view (Story 1.4)

### Story 1.10: Archive and Restore Completed Tasks — CONFIRMED

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

- **Per-perspective task placement.** Flagged in Stories 1.6 and 1.10: the SOW's task record has one `quadrant`/`rank` pair, but delegation/sharing/archiving all need the delegator's own tracking view and the recipient's independently-chosen placement to coexist without colliding. Needs a concrete data-model decision (per-perspective placement records vs. a lightweight tracking-card concept referencing one canonical task) before Story 1.6 can be built.
