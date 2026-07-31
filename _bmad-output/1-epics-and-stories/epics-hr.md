---
stepsCompleted: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13', '1.14']
inputDocuments: ['_bmad-output/2-current-work/spec-employee-management.md']
---

# Nexus CRM — HR Epic Breakdown

## Overview

User stories for the HR module, decomposed from `spec-employee-management.md` (Employee Directory CRUD) and the Organization Chart requirements gathered from the client-provided `HRM VIEW` demo prototype. Reviewed and confirmed one story at a time with the product owner.

## Epic List

1. HR — Employee Directory & Organization Visibility

## Epic 1: HR — Employee Directory & Organization Visibility

Give HR and management a real, permission-gated system of record for internal staff — replacing the current non-functional placeholder screen — plus a visual reporting-structure view derived from that same data.

### Story 1.1: View Employee Directory — CONFIRMED

As an **HR admin or manager with directory access**,
I want **to see a searchable list of all employees in my organization**,
So that **I can quickly find someone's role, department, and status without digging through spreadsheets**.

**Acceptance Criteria:**

**Given** I have the `EMPLOYEES_VIEW` permission
**When** I open the Employees page
**Then** I see a table of every employee in my tenant (name, title, department, employment status)
**And** I can search/filter the list by name

**Given** I do **not** have `EMPLOYEES_VIEW`
**When** I look at the sidebar
**Then** the Employees link does not appear at all (closing today's gap, where it's visible to everyone regardless of permission)

**Given** the tenant has zero employees yet
**When** I open the Employees page
**Then** I see a genuine empty state, not fake placeholder data

**Confirmation note (2026-07-20):** No `EMPLOYEES_MANAGE` permission exists in this codebase's Employees permission set — `EMPLOYEES_VIEW` alone gates list/detail reads. `spec-employee-management.md` updated to match.

### Story 1.2: Create Employee Record — CONFIRMED

As an **HR admin with employee-creation access**,
I want **to add a new employee with their full HR record, organized into logical tabs**,
So that **a new hire is completely and accurately captured in one place, matching how HR actually thinks about an employee's information**.

**Acceptance Criteria:**

**Given** I have the `EMPLOYEES_CREATE` permission
**When** I click "Add Employee"
**Then** I see a tabbed form with three tabs visible to any creator: **Personal**, **Employment**, **Contact**

**Given** I am on the **Personal** tab
**When** I fill in the form
**Then** I can enter: full name (required), date of birth, gender, nationality, bio, and upload a profile photo

**Given** I am on the **Employment** tab
**When** I fill in the form
**Then** I can enter: employee code, title, designation, department (dropdown), employment type, employment status, date of joined, primary location, base country, clearance level, and upload a CV. **Reporting manager is not set here** — every new employee starts unplaced in the reporting structure; who they report to is set exclusively via the Organization Chart (Story 1.8), so there's only ever one place that relationship gets edited

**Given** I am on the **Contact** tab
**When** I fill in the form
**Then** I can enter: email, mobile number (with country-code selector), and office number

**Given** I additionally have the `EMPLOYEES_MANAGE_SENSITIVE` permission
**When** I open the Add Employee form
**Then** I see a fourth tab, **Confidential**, containing NIC/passport number and base salary

**Given** I do **not** have `EMPLOYEES_MANAGE_SENSITIVE`
**When** I open the Add Employee form
**Then** the Confidential tab does not exist at all in the UI (not just disabled/hidden fields — its presence isn't revealed to me)

**Given** I try to save without a required field (e.g. full name)
**When** I submit the form, regardless of which tab the error is on
**Then** I see a clear inline validation error and nothing is saved; if the error is on a tab I'm not currently viewing, I'm taken to it

**Given** I save a new employee successfully
**When** the save completes
**Then** the new record appears in the Employee Directory (Story 1.1) immediately

**Risk accepted (2026-07-20):** NIC/passport number has no encryption-at-rest implemented yet — the `EMPLOYEES_MANAGE_SENSITIVE` gate restricts *who can see/edit* the field via the app, but the underlying database value is still stored as plain text. Client explicitly chose to ship with this residual risk rather than block the feature on building encryption first. Encryption-at-rest remains a separate, deferred task.

### Story 1.3: View Employee Details — CONFIRMED

As an **HR admin or manager with directory access**,
I want **to open a single employee's full record from the directory**,
So that **I can review everything about them without editing anything by accident**.

**Acceptance Criteria:**

**Given** I have `EMPLOYEES_VIEW` and click an employee in the directory
**When** the detail view opens
**Then** I see their Personal, Employment, and Contact tabs (read-only) — the same grouping as the create form

**Given** I do **not** have `EMPLOYEES_MANAGE_SENSITIVE`
**When** I open an employee's detail view
**Then** the Confidential tab (NIC, salary) is absent, exactly as in the create form

**Given** I have `EMPLOYEES_MANAGE_SENSITIVE`
**When** I open an employee's detail view
**Then** I see the Confidential tab with their NIC/passport and salary

**Given** an employee has a linked User login account
**When** I view their record
**Then** I can see which login account they're linked to (read-only here — the link itself is only ever created/changed from User Management, Story 1.6, not from Employee Management)

### Story 1.4: Update Employee Record — CONFIRMED

As an **HR admin with edit access**,
I want **to edit an existing employee's details, using the same tabbed layout as creation**,
So that **I can keep their record accurate as things change — a promotion, a new manager, updated contact info — without re-entering everything from scratch**.

**Acceptance Criteria:**

**Given** I have `EMPLOYEES_UPDATE` and open an employee's edit form
**When** the form loads
**Then** it's pre-filled with their current Personal, Employment, and Contact tab data

**Given** I additionally have `EMPLOYEES_MANAGE_SENSITIVE`
**When** I open the edit form
**Then** the Confidential tab is present and pre-filled (NIC, salary); without that permission, the tab is absent, same as create/view

**Given** I change their department
**When** I save
**Then** the change is reflected immediately in the Employee Directory and the Organization Chart (card color/grouping). **Reporting manager is not editable here either** — same reasoning as Story 1.2, changing who someone reports to only ever happens via the Organization Chart (Story 1.8)

**Given** I have `EMPLOYEES_UPDATE` but *not* `EMPLOYEES_MANAGE_SENSITIVE`, and this employee already has NIC/salary values saved
**When** I submit an edit to their non-sensitive fields
**Then** their existing NIC/salary values are left completely untouched — my edit can't accidentally wipe data I can't even see

**Given** I clear a previously-set optional field (e.g. remove their bio)
**When** I save
**Then** it's actually cleared in the record, not silently ignored

**Given** I upload a new profile photo or CV, replacing an existing one
**When** I save
**Then** the old file is replaced (not just orphaned in storage) and the new one displays immediately

### Story 1.5: Deactivate (Exit) or Delete an Employee Record — CONFIRMED

As an **HR admin**,
I want **to mark an employee as exited when they leave, and separately have the option to fully delete a record that was created by mistake**,
So that **former employees' historical HR data is preserved for compliance, while genuine data-entry errors can still be cleaned up**.

**Acceptance Criteria:**

**Given** I have `EMPLOYEES_UPDATE` and select "Mark as Exited" on an active employee
**When** I confirm and provide an exit date
**Then** their `employmentStatus` changes to an exited/terminated state and `dateOfExit` is set — the record stays fully visible in the directory and their history (e.g. past reporting lines) is preserved

**Given** an employee has been marked as exited
**When** I view the directory
**Then** I can still see them (e.g. via a status filter) rather than them silently vanishing

**Given** I have `EMPLOYEES_DELETE` and choose "Delete" on a record
**When** I confirm the action (with a clear warning this is different from marking someone as exited)
**Then** the record is soft-removed — consistent with how Users/Deals/Companies already handle deletion elsewhere in this app (recoverable at the DB level, not a hard destructive delete, but gone from the UI)

**Given** I have `EMPLOYEES_UPDATE` but *not* `EMPLOYEES_DELETE`
**When** I view an employee's record
**Then** I can mark them as exited, but the "Delete" action is not available to me

### Story 1.6: Grant Login Access to an Employee (from User Management) — CONFIRMED

As an **admin**,
I want **to create a login account for an employee from User Management by selecting their existing HR record**,
So that **system access is only granted when actually needed, and stays properly tied to the right person instead of two disconnected records existing for the same employee**.

**Acceptance Criteria:**

**Given** I have `USERS_CREATE` and open "Add User" in User Management
**When** I fill out the form
**Then** I can search for and select an existing Employee (from my tenant) to link this new User account to — or leave it unlinked if this login isn't tied to a tracked employee

**Given** I select an Employee while creating a User
**When** the form loads their info
**Then** Display Name and Login Email are pre-filled from the Employee record (still editable), so I'm not retyping what HR already has on file

**Given** I try to link an Employee who's already linked to a different User account
**When** I attempt to save
**Then** I get a clear error — one Employee can only be linked to one User account at a time

**Given** I'm editing an existing User account that has no Employee link yet
**When** I open their edit form
**Then** I can retroactively link them to an Employee (covers accounts created before this feature existed)

**Given** an Employee is linked to a User account
**When** I view that Employee's record in Employee Management (Stories 1.3/1.4)
**Then** I see which User account they're linked to, read-only — the link is only ever created or changed from User Management

**Given** the Employee picker loads its options
**When** I search for someone to link
**Then** it only shows Employees from my own tenant, and excludes anyone already linked to another User account

### Story 1.7: View the Organization Chart — CONFIRMED

As a **user with directory access**,
I want **to see the org chart as it currently stands — including a Company root, and which employees haven't been placed into the structure yet**,
So that **I understand both the reporting structure and where HR data is incomplete**.

**Acceptance Criteria:**

**Given** I have `EMPLOYEES_VIEW` and open the Organization Chart
**When** it loads
**Then** a single **Company** root node is always present at the top, named after my tenant — it's never created or deleted by anyone, it's just always there

**Given** an employee already has a manager set
**When** I view the chart
**Then** they appear connected in the tree beneath their manager, colored by department, auto-arranged top-down

**Given** an employee has no manager set yet (unplaced) — including every brand-new employee, since Reporting Manager is no longer set via the Employee form
**When** I view the chart
**Then** they appear in a separate side panel, visible to me even without edit access, so data gaps are visible to everyone — not floating loose on the canvas

**Given** an employee has been marked as exited (Story 1.5)
**When** I view the chart
**Then** they don't appear on the canvas or in the unplaced panel

### Story 1.8: Restructure the Org Chart as a Playground — CONFIRMED

As an **HR admin with edit access**,
I want **to enter edit mode, drag Department anchors and employees from the panel onto the canvas, redraw reporting connections, and review/save all my changes at once**,
So that **I can build or restructure the org the way I'd actually think about it — including starting completely from scratch — without committing one change at a time**.

**Acceptance Criteria:**

**Given** I have `EMPLOYEES_UPDATE`
**When** I view the chart
**Then** I see an "Edit Chart" button; without that permission, the button doesn't appear and the chart stays view-only

**Given** I click "Edit Chart"
**When** edit mode activates
**Then** I can: drag Department nodes from the panel onto the canvas as visual/structural anchors (they don't set anyone's actual department field — that's still edited via the Employee form), drag an employee from the unplaced panel onto the canvas and connect them to their manager, drag a new connection between two already-placed cards to re-parent someone, and freely reposition any card — with **no** create/delete of employee records available here

**Given** my tenant has no chart built yet (first time)
**When** I open edit mode
**Then** every employee starts in the unplaced panel and the canvas has only the Company root — I build the whole structure by dragging Department anchors and people into place

**Given** I make several changes while in edit mode
**When** I haven't clicked Save yet
**Then** nothing is written to the database — other people viewing the chart right now still see the last-saved state

**Given** I click "Save"
**When** the confirmation dialog appears and I confirm
**Then** every changed reporting relationship is sent to the backend together and saved to the real Employee records' `reportingManagerId` in one go

**Given** I've made changes but decide not to keep them
**When** I click "Cancel" or leave edit mode without saving
**Then** all pending changes are discarded and the chart reverts to the last-saved state

**Given** my pending changes would create a reporting loop
**When** I try to draw that connection
**Then** it's rejected immediately, before I even get to Save

### Story 1.9: Navigate a Large Org Chart — CONFIRMED

As a **user viewing the org chart**,
So that **a chart with many employees stays usable instead of turning into an unreadable tangle**,
I want **to zoom, pan, snap the view to fit everything, and collapse a manager's branch to hide their reports temporarily**.

**Acceptance Criteria:**

**Given** I'm viewing the chart
**When** I scroll/pinch or use on-screen controls
**Then** I can zoom in/out and pan around the canvas freely

**Given** the chart extends beyond my screen
**When** I click "Zoom to Fit"
**Then** the view adjusts to show the entire chart at once

**Given** a manager has direct reports
**When** I click the collapse control on their card
**Then** their whole branch hides, and the card shows an indicator that it's collapsed (click again to expand)

**Given** I'm in edit mode (Story 1.8) and have manually repositioned several cards
**When** I click "Auto-arrange"
**Then** the canvas snaps back to the automatic top-down tree layout (this is a layout reset, not a save — I'd still need to click Save afterward to keep it)

### Story 1.10: Export the Org Chart as an Image — CONFIRMED

As a **manager or HR user**,
I want **to export the current chart view as a PNG image**,
So that **I can drop it into a slide deck, a board report, or share it with someone who doesn't have system access, without them needing to log in**.

**Acceptance Criteria:**

**Given** I'm viewing the chart (any zoom/pan state, collapsed or expanded)
**When** I click "Export as PNG"
**Then** an image downloads matching exactly what's currently visible on my screen

**Given** I have collapsed some branches before exporting
**When** the image is generated
**Then** it reflects the collapsed state — not a forced full expansion

### Already shipped: My Profile — account/login details & change password

Built and deployed earlier this session, predating this story-review process — documented here for completeness since later stories (1.11+) extend the same "My Profile" page. Covers: viewing own display name/username/login email/status/roles/tenant/last login, and self-service password change (with complexity requirements and a live strength checklist), gated by no permission beyond being authenticated (`POST /users/me/change-password`). Not re-confirmed as a story since it's already live.

### Story 1.11: View My Own Employee Details on My Profile — CONFIRMED

As an **employee with a linked login account**,
I want **to see my own HR record (Personal, Employment, Contact — not Confidential) on my Profile page**,
So that **I can check what HR has on file for me without needing directory access to the whole company**.

**Acceptance Criteria:**

**Given** my User account is linked to an Employee record (Story 1.6)
**When** I open My Profile
**Then** I see a new section/tab showing my own Personal, Employment, and Contact details, read-only — I can't edit them myself, this stays HR-controlled

**Given** my User account is linked to an Employee record
**When** I view my own profile
**Then** I do **not** see the Confidential tab (NIC, salary) here either, even though it's *my own* data — that stays gated by `EMPLOYEES_MANAGE_SENSITIVE`, not by "is this me"

**Given** my User account is **not** linked to any Employee record
**When** I open My Profile
**Then** I just see my account/login section as it exists today — no broken or empty Employee section

### Story 1.12: Self-Report a Certification — CONFIRMED

As an **employee**,
I want **to add a certification I've earned to my own profile, with supporting evidence, and see its verification status**,
So that **my qualifications are on record as soon as I earn them, without waiting on HR to find out and enter it manually**.

**Acceptance Criteria:**

**Given** I'm on My Profile
**When** I add a new certification
**Then** I can enter: certification name, issuing organization, credential ID (optional), issue date, expiry date (optional), and either upload a certificate file or paste a public verification link

**Given** I submit a new certification
**When** it saves
**Then** its status is **Pending** — it's visible on my profile marked as unverified, and it does not yet count toward any "certified employees" search (Story 1.14)

**Given** I have a certification that's still **Pending**
**When** I edit or delete it
**Then** I can freely fix mistakes or remove it, since nobody has relied on it yet

**Given** a certification of mine has already been **Verified**
**When** I try to edit or delete it
**Then** I can't — a verified record is locked from employee edits; if something's wrong, I'd need to submit a new claim or contact HR, so a "verified" badge can't quietly be edited into something false after the fact

**Data model note:** a new table, `EmployeeCertification` (not new columns on `Employee` — one employee can hold many certifications):

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `tenantId` | uuid | tenant scoping, same pattern as every other table |
| `employeeId` | uuid (FK → Employee) | whose certification this is |
| `name` | string | e.g. "AWS Certified Solutions Architect" |
| `issuingOrganization` | string | |
| `credentialId` | string, optional | |
| `issueDate` | date | |
| `expiryDate` | date, optional | captured now; auto-logic on it is a fast-follow |
| `evidenceFileUrl` | string, optional | via the existing Uploads module |
| `evidenceLink` | string, optional | alternative to a file |
| `status` | enum: Pending / Verified / Rejected | |
| `verifiedById` | uuid (FK → User), optional | |
| `verifiedAt` | timestamp, optional | |
| `rejectionReason` | string, optional | only set when Rejected |
| `createdAt`/`updatedAt`/`createdBy`/`updatedBy` | standard audit fields | matches the `AuditedTenantEntity` base pattern used elsewhere |

**Default decision (2026-07-20):** evidence is **not** mandatory to submit a claim (so an employee isn't blocked from starting the record before they have the file handy) — but per Story 1.13, a claim with neither `evidenceFileUrl` nor `evidenceLink` cannot be marked Verified.

### Story 1.13: HR Verifies or Rejects a Claimed Certification — CONFIRMED

As an **HR admin responsible for certification review**,
I want **to see every pending certification claim across the organization, review the evidence, and mark each as Verified or Rejected**,
So that **the "certified employees" data used for project staffing is actually trustworthy, not just self-reported claims nobody checked**.

**Acceptance Criteria:**

**Given** I have a new permission, `EMPLOYEES_VERIFY_CERTIFICATIONS`
**When** I open the certification review queue
**Then** I see every Pending certification across the tenant — who submitted it, the certification details, and the uploaded evidence/link

**Given** I review a pending claim and the evidence checks out
**When** I mark it **Verified**
**Then** it's stamped with who verified it and when, and it now counts toward the "certified employees" search (Story 1.14)

**Given** a pending claim has no evidence attached (no file, no link)
**When** I try to mark it Verified
**Then** I can't — an unsupported claim can be Rejected, but not Verified, until evidence is attached

**Given** I review a pending claim and it doesn't check out
**When** I mark it **Rejected** with a reason
**Then** the employee can see why it was rejected on their own profile, and it does not count toward staffing search

**Given** I have `EMPLOYEES_VERIFY_CERTIFICATIONS` but not general `EMPLOYEES_UPDATE`
**When** I use this review queue
**Then** I can still verify/reject certifications — this is a distinct capability from general employee-record editing, since the person trusted to check certificates (e.g. an L&D coordinator) isn't necessarily the same person who edits HR records

### Story 1.14: Find Certified Employees for Project Staffing — CONFIRMED

As a **manager or HR user staffing a project**,
I want **to search for employees who hold a specific verified certification**,
So that **I can quickly identify who's qualified for a project requirement, trusting the result because only verified claims show up**.

**Acceptance Criteria:**

**Given** I have `EMPLOYEES_VIEW` and search certifications by name (e.g. "AWS Solutions Architect")
**When** results come back
**Then** I see only employees with that certification **Verified** — Pending and Rejected claims never appear here

**Given** a matching employee's certification has an expiry date
**When** I view the result
**Then** the expiry date is shown so I can judge relevance myself — v1 doesn't auto-exclude expired certifications, since that smart behavior was scoped as a fast-follow

**Given** no employee holds a matching verified certification
**When** I search
**Then** I get a clear "no matches" result, not an error or an empty-looking broken screen

## Deferred (not in this release)

- **Indirect / dotted-line reporting.** The client-provided demo supports a second relationship type (an employee reporting, in a secondary/dotted sense, to more than one manager) with its own toggleable view. This epic ships direct-line reporting only. Raised three times during story review without a scope decision from the product owner — treated as **out of scope for this release** rather than left ambiguous; revisit as its own story (working title: "Story 1.15: View/Edit Indirect Reporting Lines") if the client confirms it's needed.
- **Certification expiry logic** (auto-flagging expired certifications, excluding them from staffing search, renewal reminders). The `expiryDate` field is captured starting in Story 1.12, but no behavior acts on it yet.
- **Manager-level certification verification.** Story 1.13 restricts verification to `EMPLOYEES_VERIFY_CERTIFICATIONS` holders (HR), not an employee's own reporting manager — revisit if the client wants managers to verify their own team's claims.
- **Real-time multi-user collaboration** (multiple HR admins editing the chart simultaneously with live cursors, as in the demo). Not pursued unless confirmed necessary — the batch edit-mode/save flow in Story 1.8 assumes single-editor-at-a-time, consistent with how every other form in this app already works.
