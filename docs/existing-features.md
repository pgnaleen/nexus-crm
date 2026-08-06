# Orelia CRM — Existing Features

A plain-language list of everything already built in the system today, grouped by area.
Placeholder ("Coming Soon") pages are marked as such — everything else listed is real and working.

## Sales / Deals

- **Funnel** — the main deal pipeline: a drag-and-drop board organized by stage. Adding or
  viewing a deal opens a dialog with tabs for Deal Info, Tender details (when the deal is flagged
  as a tender), Delivery, Costing, Competition, Team, Documents, and Notes. Deals support multiple
  currencies, partner companies, assigned team roles, and an internal review/voting step.
- **Priority Tracker** — a personal task board (Eisenhower-style: Decide / Do / Delegate / Delete
  quadrants). Users can drag tasks between quadrants, delegate tasks to teammates, share tasks,
  comment on them, and see updates from others live, without refreshing the page.
- **Reminders & Notifications** — background support for alerting users about deals and tasks.
- **Deal Registration** — sidebar entry exists; not built yet (placeholder).
- **Leads** — sidebar entry exists; not built yet (placeholder).
- **Finance** — sidebar entry exists; not built yet (placeholder).
- **Legal** — sidebar entry exists; not built yet (placeholder).

## Companies & Contacts

- **Companies** and **Contacts** pages exist but are not fully wired up yet — search/filter
  controls are present but not connected to real data or an "Add" action yet.
- **Relationships** — where Companies and Contacts are actually tagged and managed today, grouped
  by relationship type (e.g. Partner, Vendor). Deleting a relationship type warns the user what
  else will be affected before it's allowed.

## HR / Employees

- **Employees** — a directory of employee records, filterable by department, with add/edit forms.
- **Org Chart** — a visual, drag-to-rearrange organization chart built from Department data.
- **Certifications** — one page with two views: certifications waiting for approval, and a
  searchable list of already-certified staff.
- **My Profile** — each user's own page: change password, view their own HR record (if they're
  linked to an employee) and their own certifications.

## Admin & Access Control

- **Roles** — create roles and control exactly what each role can do per area of the system
  (View / Create / Edit / Delete, individually, for Companies, Contacts, Deals, Users, Teams, and
  more).
- **Users** — create, disable, or remove user accounts and assign them roles. New users
  automatically get a welcome email.
- **Teams, Departments, Deal Sources, Pipeline Stages, Relationship Types** — each has its own
  simple admin screen for managing that list (used as dropdown options elsewhere in the app).
- **Tenants** — platform-level screen (for our own admins only) to create and manage customer
  organizations, and assign their plan/industry.
- **Settings** — one page with two tabs: trigger a manual database backup, and view the Activity
  Log (a record of who changed what, and when, across the system).

## Platform-wide Capabilities

- **Multi-tenant with "Act as Tenant"** — every customer's data is kept separate; our own platform
  admins can temporarily switch into viewing/acting as a specific customer to help them, then
  switch back.
- **Audit trail** — every significant change (deals, companies/contacts, users, roles, teams,
  employees, certifications, tasks, etc.) is logged with who made the change and what changed,
  visible in the Activity Log.
- **Safe deletion** — deleting something with dependent records warns the user what else will be
  removed and requires re-entering their password before it proceeds.
- **Multi-language readiness** — all new screens are being built so another language can be added
  later without rewriting them; only English exists today.
- **Consistent visual design** — a shared color/typography system is used across the app; older
  screens are gradually being brought in line with it.
- **Live updates** — the Priority Tracker uses real-time updates so shared/delegated tasks appear
  instantly for the other person.
- **File uploads** — documents attached to deals are stored securely in cloud storage.
- **Multi-currency support** — deal values can be entered in different currencies and viewed
  converted to a currency the user chooses, using up-to-date exchange rates.
- **Dashboard** — a home screen with configurable widgets: at-risk deals, deals by department,
  deals by source, deals by stage, partner insights, revenue forecast, revenue trend, sales funnel
  chart, target revenue progress, task completion, team performance, company growth (platform
  level), users by role, and deal value by stage.
