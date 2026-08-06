# Platform Layer, Workflow Engine & Tender Ingestion — Estimation & Task Breakdown

Companion to `plan-platform-layer-and-workflow-engine.md` — that document is the strategy/architecture;
this one is the delivery estimate for the same phases.

## Assumptions behind these numbers

These are **manual engineering estimates for a human team working at normal pace** — not AI-assisted
generation time, and not "best case." They assume:

- A team already familiar with this codebase's conventions (the same team that's been building
  Orelia CRM — no ramp-up time budgeted for learning `TenantOwnedEntity`/RBAC/audit patterns).
- **1 person-day = one developer, one working day**, inclusive of that task's own dev-box testing,
  but **not** inclusive of code review, QA pass, staging verification, or bug-fix cycles — those are
  called out as separate line items per phase, not folded into each task silently.
- Backend and frontend tasks are listed separately; if backend and frontend developers work in
  parallel, **calendar time is roughly the longer of the two per phase**, not the sum — the
  "Person-days" column is total effort, not elapsed time. A rough calendar-time conversion assuming
  a 3-person team (2 backend, 1 frontend) working in parallel is given per phase.
- Phase 2 (Camunda), Phase 7 (tender scraping), and Phase 9 (RAG) carry the widest uncertainty
  bands in this whole document — new infrastructure/new dependency integration is inherently less
  predictable than extending existing patterns. Treat those three phases' numbers as **±40%**, not
  the ±15% that applies to phases extending already-proven patterns (RBAC, audit log, dashboard
  widgets).
- Phase 7 numbers assume typical, moderately messy government/procurement tender-listing sites
  (some inconsistency in formatting, occasional PDF, no login wall). If the two actual Sri Lankan
  sites turn out to require login, heavy JS rendering, or scanned-image PDFs (needing OCR), add the
  contingency noted in that phase's row.
- Estimates exclude environment/DevOps overhead beyond what's explicitly listed (e.g. general CI
  pipeline maintenance, non-project infra work).

---

## Phase 0 — Foundations

| Task | Estimate | Notes |
|---|---|---|
| Add `FINANCE_*`/`LEGAL_*`/`HR_*`/`WORKFLOW_*` permission keys to `permissions.ts` + seed data | 0.5 day | Mechanical, follows existing 4-permission pattern |
| Split HR permissions into tenant-scoped vs. `isPlatformOnly` | 0.5 day | Small addition on top of the above |
| Design + migrate `tenant_module_config` table (`AuditedTenantEntity`) | 1 day | New TypeORM entity + migration |
| Build `ModuleGuard` (mirrors `PermissionsGuard`) | 1 day | New guard + unit tests |
| Code review + fixes | 0.5 day | |

**Phase 0 subtotal: 3.5 person-days (~1 calendar week for 1 backend dev)**

---

## Phase 1 — On-demand module enabling

| Task | Estimate | Notes |
|---|---|---|
| Backend: module-config CRUD service + controller | 1.5 days | |
| Wire `AuditLogService.record()` into enable/disable | 0.5 day | Reuses existing pattern |
| Apply `ModuleGuard` across module-scoped routes | 1 day | Touches every route in scope, mechanical but broad |
| Frontend: System-tenant admin screen (toggle per tenant) | 2 days | New page, table + toggle UI |
| Frontend: nav reads enabled-module list at layout load | 1 day | |
| QA pass (enable/disable across 2–3 tenants, verify guard blocks disabled routes) | 1 day | |
| Code review + fixes | 0.5 day | |

**Phase 1 subtotal: 7.5 person-days (~1.5 calendar weeks, backend + frontend overlapping)**

---

## Phase 2 — Camunda infrastructure ⚠ wide band (±40%)

| Task | Estimate | Notes |
|---|---|---|
| Add Zeebe + Operate to `docker-compose.yml`, verify local bring-up | 1.5 days | New infra, first-time setup friction likely |
| Learning/spike: Zeebe client API, BPMN modeling basics | 2 days | Real cost even for an experienced team if nobody has used Camunda 8 before — do not skip this line |
| Backend: Zeebe client wrapper module (start-instance, list-instances, complete-task) | 3 days | |
| Backend: job-worker registration point for service tasks | 2 days | |
| Author first BPMN process (Employee onboarding) in Camunda Modeler | 2 days | Includes iterating the process model itself |
| Wire onboarding service tasks (provision accounts, assign certifications, manager checklist) | 3 days | Touches `employees`/`certifications`/`notifications` |
| Integration testing (start → complete full onboarding instance end-to-end) | 2 days | |
| Code review + fixes | 1 day | |

**Phase 2 subtotal: 16.5 person-days (~2.5–3 calendar weeks) — treat as 10–23 days given the ±40% band**

---

## Phase 3 — Platform Finance/Legal/HR dashboards

| Task | Estimate | Notes |
|---|---|---|
| Cross-tenant read endpoints — Finance (platform revenue/ARR rollups) | 3 days | Scope depends on exact metrics wanted — see plan doc's open items |
| Cross-tenant read endpoints — Legal (shared templates/compliance) | 2.5 days | |
| Super-tenant HR: reuse `employees`/`certifications` scoped to System tenant | 1.5 days | Cheaper than Finance/Legal — no cross-tenant read, just new permission wiring |
| Dashboard widgets (3 modules) reusing existing permission-filtered widget framework | 3 days | |
| Flag cross-tenant reads in `api-endpoint-registry.md` per the plan's data-residency note | 0.5 day | Documentation task, not optional |
| QA pass (verify a non-System-tenant user cannot reach any of this) | 1.5 days | Security-sensitive area — don't compress this |
| Code review + fixes | 1 day | |

**Phase 3 subtotal: 13 person-days (~2 calendar weeks)**

---

## Phase 4 — Tenant-level Finance/Legal build-out

Scope here is genuinely open (the plan doc marks tenant-level Finance/Legal as "turn the Coming
Soon placeholder into real features" without a finalized feature list yet) — the estimate below
assumes a first, modest real feature per module, not a full accounting/legal suite. **Re-estimate
this phase once the actual Finance/Legal feature list is confirmed — treat this row as a
placeholder order-of-magnitude, not a committed number.**

| Task | Estimate | Notes |
|---|---|---|
| Finance: first real feature (e.g. deal costing/invoicing view) | 6 days | Backend + frontend combined, assumes 1 concrete feature |
| Legal: first real feature (e.g. tenant contract records) | 5 days | Same caveat |
| RBAC + module-gating wiring for both | 1.5 days | |
| QA pass | 2 days | |
| Code review + fixes | 1 day | |

**Phase 4 subtotal: 15.5 person-days (~2.5 calendar weeks) — treat as a placeholder pending real feature scoping**

---

## Phase 5 — Workflow UI + notification integration

| Task | Estimate | Notes |
|---|---|---|
| Frontend: task inbox ("my tasks") screen | 2.5 days | |
| Frontend: process instance list + detail/history view | 3 days | |
| Backend: endpoints backing both screens (calls into Phase 2's Zeebe wrapper) | 2 days | |
| Wire task lifecycle events into `modules/notifications` | 2 days | |
| QA pass | 1.5 days | |
| Code review + fixes | 1 day | |

**Phase 5 subtotal: 12 person-days (~2 calendar weeks)**

---

## Phase 6 — Additional workflow catalog rollout

Each row is one process: BPMN model + service-task wiring + minimal UI hook, at the same rigor as
Phase 2's Employee onboarding reference build. **These can be reprioritized/reordered per the
chief architect's call flagged in the main plan doc — the estimate per row doesn't change with
order, only the total elapsed calendar time if done sequentially vs. in parallel.**

| Process | Estimate | Notes |
|---|---|---|
| Recruitment (requisition → interview loop → offer) | 6 days | Largest of this batch — most approval steps |
| Employee offboarding | 3.5 days | Reuses onboarding's provisioning integrations in reverse |
| Deal approval (discount/terms threshold) | 3.5 days | Touches existing Funnel/Deals stage-move logic |
| Tenant onboarding (internal provisioning checklist) | 2.5 days | |
| Module-enable-request approval | 2 days | Only needed if Phase 0's deferred plan-tier gating decision later requires an approval step |
| Contract/legal review | 3 days | Depends on Phase 4's Legal module existing first |
| Expense/invoice approval | 3 days | Depends on Phase 4's Finance module existing first |
| Integration testing across full catalog | 2 days | |
| Code review + fixes (rolled up across catalog) | 1.5 days | |

**Phase 6 subtotal: 27 person-days (~4–5 calendar weeks if largely sequential; less if multiple processes are built in parallel by different devs)**

---

## Phase 7 — Tender scraping + LLM extraction pipeline ⚠ wide band (±40%), site-details-pending

| Task | Estimate | Notes |
|---|---|---|
| `scraped_tender` entity + migration | 1 day | |
| Site A adapter (listing scrape + detail fetch) | 3 days | Assumes server-rendered HTML, no login wall — **add 2–3 days if it turns out to need a headless browser (JS-rendered pages), and add 3–4 more if tender detail is scanned-image PDF requiring OCR** |
| Site B adapter | 3 days | Same caveat as above — two sites are being estimated as roughly similar complexity, which may not hold |
| Daily `@Cron` job + dedup-by-`externalRef` logic | 2 days | |
| LLM extraction integration (raw content → normalized fields) | 3 days | Prompt design + structured-output parsing + retry/fallback handling |
| Debug logging per this project's standing logging rule | 1 day | |
| QA pass against real site data (several real days of scrape runs, not just unit tests) | 2.5 days | This genuinely needs to run against the live sites for multiple days to validate — budget calendar time, not just dev-days |
| Code review + fixes | 1.5 days | |

**Phase 7 subtotal: 17 person-days (~3 calendar weeks) — treat as 12–24 days given the ±40% band and unresolved site-specifics**

---

## Phase 8 — Tender Suggestions UI + accept-to-Deal

| Task | Estimate | Notes |
|---|---|---|
| Suggestions inbox page (list + filters) | 2.5 days | |
| Accept flow: prefill `AddDealDialog` from `extracted` data | 2.5 days | Reuses existing dialog, but wiring prefill + partial-field mapping takes real care |
| Reject/Ignore actions + status updates | 1 day | |
| New `TENDER_SUGGESTIONS_VIEW`/`_UPDATE` permissions | 0.5 day | |
| Sidebar badge/count | 0.5 day | |
| QA pass (accept → verify Deal created correctly, audit log entry present) | 1.5 days | |
| Code review + fixes | 1 day | |

**Phase 8 subtotal: 9.5 person-days (~1.5–2 calendar weeks)**

---

## Phase 9 — RAG relevance ranking + smarter dedup (optional) ⚠ wide band (±40%)

| Task | Estimate | Notes |
|---|---|---|
| Add `pgvector` extension + migration for embedding columns | 1 day | |
| Embedding generation pipeline (new tenders + historical won deals) | 3 days | Includes picking/wiring an embedding API |
| Relevance ranking in Suggestions UI (sort/score) | 2 days | |
| Embedding-similarity dedup logic + "possible duplicate" flag in UI | 3 days | |
| QA pass (verify ranking is sane against real historical deal data, not just synthetic) | 2 days | |
| Code review + fixes | 1 day | |

**Phase 9 subtotal: 12 person-days (~2 calendar weeks) — treat as 7–17 days given the ±40% band; lowest-priority phase in the whole plan, defer freely under time pressure**

---

## Phase 10 — Existing-system bug fixes & quality backlog

No dependency relationship with Phases 0–9 — this is already-shipped-system maintenance, not part
of the platform/workflow initiative, and can be picked up independently of everything above,
in any order.

| Task | Estimate | Notes |
|---|---|---|
| Employee creation form: add missing required-field validations + fix employment-status dropdown options | 1.5 days | Client + server-side validation, plus restricting the status enum options offered at creation |
| Prevent duplicate Contacts under the same Company | 1.5 days | Pre-create uniqueness check (name/phone/email) + clear 4xx error; existing duplicate rows are a separate cleanup decision, not auto-merged |
| RBAC: auto-enable View when Create/Edit/Delete is granted (User Management, Teams, Roles, Employees) | 2 days | `RolePermissionsDialog` UI logic + backend save-path enforcement (defense in depth, not UI-only) |
| Fix User Management status (Disable/Locked) not being enforced | 1.5 days | Access-control gap — locate and fix the missing check in the auth/login path, then verify end-to-end |
| Fix Add Company → Contact tab country dropdown rendering | 1 day | Scoped UI bug |
| Multiple sectors + multiple account tiers on Company/Customer creation | 3.5 days | Data model change (single value → many-to-many with new join table), multi-select UI, migration for existing single values |
| Show phone (T.P.) number in Company → Contact view, not just name | 1 day | Likely a response-shape/display gap rather than a missing column — confirm which before starting |
| QA pass across all seven fixes | 1.5 days | |
| Code review + fixes | 1 day | |

**Phase 10 subtotal: 14.5 person-days (~2.5 calendar weeks) — independent of the platform/workflow phases, can run in parallel with any of them**

---

## Grand total

| Phase | Person-days | Rough calendar time (3-person team) |
|---|---|---|
| 0 — Foundations | 3.5 | 0.5–1 week |
| 1 — Module enabling | 7.5 | 1–1.5 weeks |
| 2 — Camunda infra ⚠ | 16.5 (band 10–23) | 2.5–3.5 weeks |
| 3 — Platform dashboards | 13 | 2 weeks |
| 4 — Tenant Finance/Legal (placeholder) | 15.5 | 2.5 weeks |
| 5 — Workflow UI + notifications | 12 | 2 weeks |
| 6 — Workflow catalog rollout | 27 | 4–5 weeks |
| 7 — Tender scraping ⚠ | 17 (band 12–24) | 3 weeks |
| 8 — Tender Suggestions UI | 9.5 | 1.5–2 weeks |
| 9 — RAG ranking/dedup ⚠ (optional) | 12 (band 7–17) | 2 weeks |
| 10 — Existing-system bug fixes | 14.5 | 2.5 weeks (independent, can overlap any of the above) |
| **Total (all phases)** | **~148.5 person-days** | **~23.5–26.5 calendar weeks if run mostly sequentially** |
| **Total excluding Phase 10** (existing-system bug fixes — separate workstream, not part of the platform/workflow initiative's own scope) | **~134 person-days** | **~21–24 calendar weeks** |

**On sequencing for calendar time:** the phases are not all dependencies of each other (see the
mermaid dependency graph in the main plan doc) — Phase 4 can run parallel to Phase 3, Phase 7 can
start as soon as Phase 1 lands without waiting on Camunda at all. A team large enough to run 2–3
phase-tracks in parallel could realistically compress the ~21–24 calendar-week sequential estimate
down toward **14–16 calendar weeks**. The person-day totals above don't change with parallelization
— only calendar time does.
