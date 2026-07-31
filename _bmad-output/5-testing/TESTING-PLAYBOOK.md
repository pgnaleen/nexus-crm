# NexusCRM — Section Testing Playbook

One repeatable procedure applied **identically to every section** (module). Do not invent a
per-section process — copy this one. Results for every section are recorded in
[`TEST-RESULTS.md`](./TEST-RESULTS.md).

A "section" = one backend module (`backend/src/modules/<name>`) or one frontend area
(`frontend/src/app/<area>`).

---

## Step 0 — One-time setup (do this ONCE, before section 1)

No test runner is installed yet. Set up the stack once:

- **Backend unit + integration:** Jest + `@nestjs/testing` (already present) + `supertest`.
- **Backend integration DB:** a disposable test database (Docker) — never the dev DB.
- **Frontend E2E:** Playwright (optional, for UI-heavy sections).

Add `test`, `test:cov`, and `test:e2e` scripts to `backend/package.json`. Confirm one trivial
test runs green before starting section 1. Record the date completed at the top of
`TEST-RESULTS.md`.

---

## The per-section procedure (repeat for EVERY section)

For section `<name>`, do the four phases in order. Do **not** advance to the next section until
Phase 4 is recorded.

### Phase 1 — Unit tests
- Target: services, guards, pipes, pure helpers — dependencies mocked.
- Cover: happy path, each validation branch, each error/throw path.
- Exit bar: business logic branches covered; suite green.

### Phase 2 — Integration tests
- Target: every controller endpoint, controller → service → DB, against the **test DB**.
- Cover: success, validation failure (400), not-found (404), auth required (401/403).
- Exit bar: every route has at least one integration test; suite green.

### Phase 3 — Security tests  ⚠️ highest priority for this app
Run these in order — the first two catch the most damaging CRM bugs:
1. **Tenant isolation** — tenant A can never read/write/list/delete tenant B's rows.
   Test every endpoint that takes or returns an ID with a *cross-tenant* ID → expect 404/403.
2. **RBAC / authorization** — a low-privilege role cannot hit privileged endpoints; a user
   cannot act outside their assigned scope.
3. **AuthN** — endpoints reject missing/expired/tampered tokens.
4. **Input** — injection, mass-assignment / over-posting, IDOR on nested resources, file-upload
   validation (for `uploads`).
- Tooling: `/security-review` on the section's diff, plus `bmad-review-edge-case-hunter` on the
  module for orthogonal coverage.
- Exit bar: no cross-tenant leak, no privilege escalation, findings triaged.

### Phase 4 — Adversarial review + record result
- Run `bmad-code-review` on the section.
- Fix anything it surfaces, re-run the relevant phase.
- **Record the outcome** as a row in `TEST-RESULTS.md` (status, coverage, open findings, date).
- Only now move to the next section.

---

## Per-section checklist (copy this block into TEST-RESULTS.md per section)

```
### Section: <name>
- [ ] Phase 1 Unit        — green,  branches covered
- [ ] Phase 2 Integration — every endpoint has a test, green
- [ ] Phase 3 Security    — tenant isolation ✔  RBAC ✔  authN ✔  input ✔
- [ ] Phase 4 Review      — bmad-code-review passed, findings triaged
Status: NOT STARTED | IN PROGRESS | PASSED | PASSED-WITH-FINDINGS
Open findings: <link/ids or "none">
Completed: <date>
```

---

## Suggested section order (highest risk first)

1. `tenants` + `rbac` + `auth` — the isolation/authz foundation everything else relies on
2. `users`, `employees`, `departments`, `teams`
3. `companies`, `contacts`, `relationship-types`, `industries`
4. `deals`, `deal-stages`, `deal-sources`
5. `reminders`, `notifications`, `uploads`
6. Frontend areas (Playwright E2E) as needed
