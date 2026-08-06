# Proposal: Configurable Per-Company Approval Workflows (Camunda)

*Prepared for supervisor review/approval.*

---

## 1. Summary (Non-Technical)

**What we want to build:** let every company that uses ORELIA define and change its own approval
process — e.g. "which deals need sign-off, from whom, and in what order" — themselves, from
inside the product, without our engineering team hand-coding it per client.

**Why:** every company approves things differently. Today ORELIA can only support one hardcoded
approval behavior for everyone. That's a real limit on how many different companies can actually
adopt ORELIA as their CRM — this feature turns "approval process" into a configuration each
client sets up themselves, which is a meaningful product differentiator, not just an internal
convenience.

**How:** rather than build a custom rules engine from scratch — which risks quietly turning into
a multi-year side project — we adopt Camunda, a mature, widely-used, open-source engine built
specifically for this problem, and run our own private copy of it inside our own infrastructure
(client data never leaves our servers).

**What we're asking for right now:** approval to spend a small amount of time (Phase 0 below)
confirming Camunda can legally be embedded in a product we resell, and to run a throwaway
prototype to validate the approach — **not** approval of the full multi-month build yet. Full
build-out is a separate decision after the prototype proves out.

---

## 2. How It Would Work — Plain-Language Walkthrough

Think of it like giving every client company its own customizable flowchart for "what has to
happen before X counts as approved."

- **Company A** wants: *any deal over $50k needs Sales Manager approval, then Finance approval.*
- **Company B** wants: *every deal needs exactly one approval, no matter the size.*
- **Company C** wants: *deals need Legal AND Finance approval in parallel, and if nobody responds
  within 48 hours it automatically escalates to a director.*

Today ORELIA can't offer any of this — it would have to be hardcoded the same way for every
client. With this change: a company's own admin opens a "Workflow Designer" screen inside
ORELIA, drags boxes onto a canvas to build their approval flow (who approves, in what order,
under what conditions, what happens if nobody responds), and saves it. From then on, ORELIA
automatically walks each deal through that specific company's flow — routing it to the right
person, waiting for their decision, and only moving forward once it's actually approved.

**Example — Company A's flow (simple, conditional):**

```mermaid
flowchart TD
    A[New deal created] --> B{Deal value over $50k?}
    B -- Yes --> C[Sales Manager approves]
    C --> D[Finance approves]
    D --> E[Deal marked Won]
    B -- No --> F[Sales Manager approves]
    F --> E
```

**Example — Company C's flow (parallel approval + escalation):**

```mermaid
flowchart TD
    A[Deal submitted for approval] --> B[Legal approval]
    A --> C[Finance approval]
    B --> D{Both approved?}
    C --> D
    D -- Yes --> E[Deal Approved]
    D -- 48h, no response --> F[Escalate to Director]
    F --> E
```

Every box in these diagrams is something the *company's own admin* draws themselves in the
Workflow Designer — we're not hardcoding either of these, they're just two examples of what
different companies could configure.

---

## 3. What We're Adopting, and Why Not Build It Ourselves

**Camunda** is an open-source workflow/business-process engine used broadly across the industry
for exactly this kind of problem. Two design choices keep it under our own control rather than
becoming "someone else's product bolted onto ours":

- **Self-hosted, not Camunda's cloud service.** We run our own private copy inside our own
  existing hosting environment (we already host Postgres/backend/frontend ourselves — this adds
  one more service to that same setup). Client approval data never leaves our infrastructure.
- **Our own screens, not Camunda's.** We build ORELIA's own "Workflow Designer" and "My
  Approvals" screens, styled to match the rest of the product exactly. Camunda's engine runs
  underneath, invisible to the end user — it never feels like a third-party tool was dropped in.

**Why not build our own mini version of this instead?** We looked at that first. It works fine
for simple, single-step approvals — but the actual requirement here is real branching, parallel
approvals, and time-based escalation, which is a genuinely hard problem to get right and keep
reliable. Building and maintaining that ourselves is a bigger, riskier, longer-running commitment
than adopting a tool that already solves it well.

---

## 4. Technical Explanation

**Engine:** Camunda 8 (its "Zeebe" execution engine), self-hosted as a new service in our
existing Docker-based deployment, alongside the current Postgres/backend/frontend.

**Multi-tenancy:** Zeebe natively supports scoping process definitions and running instances by
tenant ID — this maps directly onto ORELIA's existing per-company tenant model, so each
company's workflows and running approvals stay isolated exactly like the rest of their data
already is.

**Backend integration:** one new backend module is the *only* thing that talks to the engine.
It: deploys a company's saved workflow to the engine; starts a new approval "instance" when
something needs approving (e.g. a deal moves stage); lists a user's pending approvals — filtered
through our own permission system first, never trusting the engine's own idea of who's allowed
what; and completes an approval (approve/reject) once verified through our own login/permissions.
Every one of those actions gets an audit-log entry, same as everything else in the system today.

**Designer screen:** built using `bpmn-js`, a free, open-source drag-and-drop diagram library
(the same one that powers Camunda's own tools, but usable standalone). We embed it directly in
our own admin page and styling — the client's admin never leaves ORELIA to use it.

**Approval screen:** a normal ORELIA screen (matching existing components/design), not Camunda's
own UI — shows "My Approvals," lets a user approve/reject, pulled from our backend which talks
to the engine behind the scenes.

**First real use case:** Deal approval before a deal counts as "Won" — opt-in per company, so
companies that don't set up a workflow keep today's behavior unchanged.

**System architecture — how the pieces fit together:**

```mermaid
flowchart LR
    subgraph FE["ORELIA Frontend (Next.js)"]
        WD["Workflow Designer screen<br/>(bpmn-js, per-company)"]
        MA["My Approvals screen"]
    end

    subgraph BE["ORELIA Backend (NestJS)"]
        WM["workflow-engine module<br/>(only thing that talks to the engine)"]
        RBAC["Existing RBAC + Audit Log"]
    end

    subgraph ENGINE["Self-hosted, our own infrastructure"]
        ZB["Camunda Zeebe engine<br/>(scoped per tenant)"]
    end

    WD -- "saves BPMN diagram" --> WM
    WM -- "deploys workflow for that tenant" --> ZB
    MA -- "fetch my tasks / approve-reject" --> WM
    WM <-- "permission check on every action" --> RBAC
    WM -- "start / complete process" --> ZB
    ZB -- "task created, process finished" --> WM
```

**Runtime example — a deal moving to "Won":**

```mermaid
sequenceDiagram
    participant Rep as Sales Rep
    participant BE as ORELIA Backend
    participant ZB as Camunda Engine
    participant Mgr as Approver

    Rep->>BE: Move deal to "Won" stage
    BE->>ZB: Start approval process (dealId, amount, tenant)
    ZB-->>BE: Task created for Approver
    BE-->>Mgr: Task appears in "My Approvals"
    Mgr->>BE: Approve
    BE->>ZB: Complete task (decision = approved)
    ZB-->>BE: Process finished (approved)
    BE->>BE: Deal status updated to Won + audit log entry
```

The deal's status only actually changes at the very last step — everything before that is the
engine walking the deal through whatever steps that specific company configured.

---

## 5. Pros

- Turns approval logic into something each client configures themselves — a real product
  differentiator vs. a rigid one-size-fits-all CRM.
- Proven, mature engine — branching, parallel approvals, timers/escalation are hard to get right;
  we're not reinventing that from zero.
- Self-hosted → client data stays inside our own infrastructure, no per-client data ever crossing
  to a third party.
- Own the UI end-to-end → feels native, not "powered by [someone else]."
- Reusable beyond deal approval later — same engine could drive contract sign-off, employee
  onboarding steps, etc., once the first use case is proven.

---

## 6. Cons / Risks (Honest Assessment)

- **New, heavier piece of infrastructure.** Our current stack is just a database and two simple
  application servers. This engine is a genuinely more complex distributed system to run,
  monitor, back up, and keep patched — a real step up in operational responsibility, not just
  "one more container."
- **Team learning curve.** Nobody on the team currently has hands-on experience running this
  engine or authoring these workflow diagrams — there's real ramp-up time before anyone is fully
  confident operating it in production.
- **Licensing needs verification before we commit (see §7).** We're planning to embed this inside
  a product we resell to many companies — that's a different licensing situation than one company
  using it internally, and we haven't confirmed the terms allow that yet.
- **Vendor/technology lock-in.** Once companies have real workflows built and running on this
  engine, migrating away later (if we ever needed to) would be costly — this is a long-term
  commitment, not something easily reversed.
- **Debugging complexity.** When something goes wrong inside a multi-step, multi-person approval
  process, tracing exactly why is inherently harder than debugging a single function call —
  this needs real investment in visibility/monitoring, not an afterthought.
- **Opportunity cost.** This is a genuinely large, multi-phase initiative that will compete with
  other roadmap work for engineering time over an extended period — worth weighing explicitly
  against what else that time could build.
- **Security surface.** A new service with its own APIs for starting/completing approvals is a
  new thing that needs a real security review (who can trigger what, on whose behalf) before it
  touches real client data.

---

## 7. Open Item Requiring Sign-Off Before Any Real Build Work

**Licensing.** Camunda's self-hosted license terms for a company that self-hosts it *for its own
internal use* are well understood — but we intend to embed it inside a product we sell/resell to
other companies, which is a different scenario and may need a different license tier or a direct
conversation with Camunda. This must be confirmed before Phase 1 infrastructure work begins — it
is not something we can resolve just by writing code, and it's the single item most likely to
change the plan.

---

## 8. Phased Plan (Rough Sizing — Engineering to Refine)

| Phase | What happens | Risk if skipped |
|---|---|---|
| **0 — Verify & scope** | Confirm licensing allows embedding in a resold product; rough infra cost/ops estimate | Could discover a licensing blocker *after* investing real build time |
| **1 — Infra spike (prototype)** | Stand up the engine in a dev environment, prove a basic "deploy a workflow → run it → approve a step" round-trip works end-to-end | No proof the approach actually works before committing further |
| **2 — Backend integration module** | Build the real integration layer: permissions, audit logging, task management | — |
| **3 — Designer screen** | Build the drag-and-drop "Workflow Designer" admin screen, per-company, with its own permissions | — |
| **4 — Approval screen + first real hook** | Build "My Approvals" UI; wire into deal-approval as the first live use case, opt-in per company | — |
| **5 — Expand** | Reuse the same engine for other approval-driven processes (contracts, onboarding, etc.) once Phase 4 is proven live | — |

**What we're asking approval for right now: Phases 0 and 1 only** — a small, low-risk
verification + prototype, not the full multi-phase commitment. We'll bring results back before
asking for sign-off on Phases 2–5.

---

## 9. Related, Separate Recommendation (Not Part of This Ask)

Separately from approval workflows, we also recommend adopting **n8n** (a lightweight,
self-hosted automation tool) for connecting ORELIA to external systems companies already use —
e.g. notifying Slack or syncing to accounting software when a deal closes. It's unrelated to this
approval-workflow effort, much lower cost/risk, and can even be triggered *from* a Camunda
workflow later (e.g. "on final approval, notify accounting" as one workflow step) — flagged here
for visibility, not asking for a decision on it in this document.
