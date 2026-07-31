# Production Deployment Plan — ORELIA / nexus-crm

**Author:** Winston (System Architect)
**Status:** Draft — awaiting sign-off before any Phase 1+ work begins
**Context:** Client begins using the deployed system at `https://sales.orelit.com` starting
2026-07-23, while the codebase is still under active daily development. This document exists so
"still building it" and "a real client depends on it" can coexist without repeating the incident
below.

---

## 1. Postmortem — 2026-07-22 login outage

**Symptom:** Client-facing login returned `500 Internal Server Error`. Reported as "the server
goes down."

**What was NOT wrong:** the EC2 instance, disk (44% used), memory (2GB free), the `backend` and
`frontend` Docker containers (both `Up`, uptime 2 days), nginx (running, correctly configured),
DNS, and the deploy process itself (`git pull` + `docker compose up -d --build`) — all confirmed
healthy at the time of the incident.

**Root cause:** the password stored in the backend's `~/nexus-crm/.env` file
(`DB_PASSWORD=<redacted>`) did not match the actual password set on the
Postgres role `nexus_user`. Every new database connection the backend opened was rejected by
Postgres with `password authentication failed for user "nexus_user"`, which surfaced to users as
a generic 500 on login (and on any other request needing a fresh DB connection).

> **Redacted 2026-07-31.** This paragraph previously quoted the literal `DB_PASSWORD` value. The
> value was never relevant to the postmortem — the finding is that the stored password *didn't
> match* the role's, not what it was. **Redacting it here does not undo the exposure:** it was
> committed in `31a9640` and pushed to a remote, so it remains in git history and must be treated
> as compromised. Rotating the credential is the only real fix — tracked as item 10 in
> [../2-current-work/open-items.md](../2-current-work/open-items.md), along with the two JWT
> secrets. Do not paste secrets into these documents; reference the variable name only.

**Why this was confusing to diagnose:** an initial test connecting via `localhost` succeeded
using the same password, which looked like proof the password was correct — it wasn't. Postgres's
`pg_hba.conf` grants unconditional `trust` (no password check at all) for `127.0.0.1`/`::1`, but
requires real `scram-sha-256` authentication for every other source address, including the
backend's actual connection path (`host.docker.internal` → Docker bridge gateway `172.17.0.1`).
The `localhost` test never actually validated anything.

**Theories ruled out, with evidence, during diagnosis** (kept here so they aren't re-litigated):
- *"Rebuilding the container regenerates `.env`"* — false. `.env` is a static file on the host
  disk; `docker compose up --build` never creates or modifies it.
- *"The container doesn't pick up the current `.env` on rebuild"* — false. Confirmed the
  container's live environment (`docker compose exec backend printenv DB_PASSWORD`) matched the
  file's current contents exactly.
- *"`git pull` overwrites `.env` with a committed version"* — false. `.env` is listed in
  `.gitignore` and was never tracked.
- *"The `setup` service (which runs before `backend`/`frontend` on every deploy) resets
  credentials"* — false. It only runs `pnpm install && pnpm --filter @orelia/common build`; it
  never touches the database.

**What is genuinely unknown:** who or what changed Postgres's actual password for `nexus_user`
before the incident. Postgres's default logging doesn't retain that history, and the
`goldbond-postgres` container (which hosts this database — see §2.3) has been running
continuously for 3+ weeks with zero restarts, so there's no restart event to correlate it to
either. This is stated plainly rather than guessed at.

**Fix applied:** `ALTER USER nexus_user WITH PASSWORD '<value already in .env>'` run directly
against `goldbond-postgres`, then verified with a real `POST /api/auth/login` returning `200`.

**Process rule this justifies** (see §4, Phase 0, item 4): any time this password changes on
either side — the `.env` file or the database role itself — both sides must be updated together,
and verified with a real login request before anyone walks away. This is a process fix, not a
tooling fix, and it is the direct answer to "how do we stop this specific class of incident."

---

## 2. Current-state architecture (as verified, 2026-07-22)

### 2.1 Compute
Single Ubuntu EC2 instance (`18.142.49.168`), hosting **three unrelated projects** on one box:
nexus-crm, an app called "goldbond," and a legacy Kanban app (port 3005). No isolation between
them beyond separate Docker containers and port numbers.

### 2.2 nexus-crm's own stack
`~/nexus-crm/docker-compose.prod.yml` — three services:
- `setup`: one-shot, installs deps and builds the shared `@orelia/common` package before the
  other two start.
- `backend`: NestJS, port 3001, built from `Dockerfile.dev` (the **development** Dockerfile),
  running `pnpm --filter @orelia/backend dev` (a hot-reload dev server, not a production build).
  Reads secrets via `env_file: .env`.
- `frontend`: Next.js, port 3000, also built from `Dockerfile.dev`, running `next build && next
  start` (this half is a real production build) with a handful of env vars hardcoded directly in
  the compose file rather than sourced from `.env`.

### 2.3 Database — the structural risk
Postgres is **not part of nexus-crm's own stack at all**. It runs inside `goldbond-postgres`, a
container belonging to the unrelated "goldbond" project, shared on the same host. nexus-crm's
backend reaches it externally via `host.docker.internal:5432`. This means nexus-crm's database
availability is coupled to a system it doesn't own, doesn't control the maintenance schedule of,
and can't audit changes to. §1's "unknown root cause" is a direct symptom of this coupling — see
§4, Phase 3, item 1.

### 2.4 Edge / TLS
nginx (native, not containerized) reverse-proxies `sales.orelit.com` (443) to `localhost:3000`,
and `/api/` to `localhost:3001`, using a manually-installed Sectigo wildcard cert. **Known
issue, explicitly out of scope for this plan**: the served certificate is missing its
intermediate CA chain (`openssl verify` fails with "unable to get local issuer certificate").
Ownership of that fix sits with someone else per direct instruction — tracked here only as a
cross-reference, not a task in this document.

### 2.5 Deploy process
Entirely manual, over SSH, no CI/CD:
```
cd ~/nexus-crm
git pull origin dev-g
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend pnpm --filter @orelia/backend migration:run
```
Run "every time, regardless of what changed." No staging environment. No automated rollback. No
health check gating success. No confirmed database backup. Everything lands on `dev-g` — the same
branch the team develops on — meaning **every commit is one deploy away from being in front of
the client**, with no deliberate promotion step in between.

### 2.6 Secrets
`~/nexus-crm/.env`, plain text, hand-edited, not version-controlled, no secrets manager. Consumed
by the `backend` service only (`env_file: .env`); the `frontend` service's few env vars are
hardcoded in the compose file instead.

---

## 3. The core problem this plan solves

**There is currently exactly one environment.** Development and production are the same box, the
same branch, the same containers. That single fact is the reason "still actively developing" and
"a live client is depending on this" feel like they're in conflict — because right now, they
structurally are. Every phase below exists to separate those two concerns, in order of urgency.

---

## 4. Phased plan

### Phase 0 — before go-live (must complete before 2026-07-23)

No new infrastructure. Directly targets recurrence of the exact incident in §1.

1. **Cut a `main` branch.** The server's deploy script pulls `main`, never `dev-g`, from this
   point forward. Nothing reaches the client until someone deliberately merges into it.
   *Needs: whoever has push/branch-protection rights on the GitHub repo — flagged in §5.*
2. **Tag every deploy** (`git tag deploy-YYYY-MM-DD-HHmm` before rebuilding). Rollback becomes
   `git checkout <previous-tag> && docker compose up -d --build` — one unambiguous command, not
   "whatever HEAD happened to be an hour ago."
3. **Add a post-deploy smoke test** to the deploy script: after `up -d --build`, curl
   `/api/auth/login` (and any other critical read path) and fail loudly — not silently — if it
   doesn't return the expected status. This is the single control that would have caught §1's
   incident automatically, before the client did.
4. **Write down the two-sided-secret rule** as an explicit step in the deploy runbook: *"Any time
   `DB_PASSWORD` (or any other credential shared between `.env` and an external system) changes
   on one side, change it on the other side in the same action, and verify with a real request
   before considering the change done."*
5. **Stand up a nightly backup** of `nexus_crm_app` specifically (not all of `goldbond-postgres`'s
   data) via `pg_dump`, stored off-box. Then **actually run one restore** into a scratch database
   to confirm the backup is real, not just scheduled. An unverified backup is a guess, not a
   safety net.
6. **Agree and communicate a deploy window** with the client (e.g. early morning, low-traffic).
   A full rebuild causes a real, brief interruption — nothing in this phase makes that zero.
   Making it predictable and communicated is the cheapest available mitigation today.

### Phase 1 — this week: environment separation

This is what actually resolves "does daily development have to stop." Cheapest viable version,
no new AWS spend: a **second docker-compose stack on the same box**, different ports, its own
`.env`, pointed at a separate `nexus_crm_staging` database inside the same Postgres instance.

Branch flow: `dev-g` (daily work, unchanged) → merge to `staging` → deploy to the staging stack,
verify → merge `staging` into `main` → deploy to prod. Development keeps moving every day.
Production only moves when a verified batch is deliberately promoted — which can still happen
daily, but as a decision, not an automatic consequence of a commit landing.

### Phase 2 — this month: remove manual steps as a source of error

1. **CI/CD** (GitHub Actions — boring, well-supported, no new vendor). On merge to `main`: run
   typecheck/tests, SSH deploy, run migrations, run the Phase 0 smoke tests, auto-tag on success.
2. **Real production Dockerfiles.** A multi-stage build (compile → copy built output + production
   dependencies only → run the compiled entrypoint) replacing `Dockerfile.dev` + `pnpm dev` for
   the backend. Smaller images, faster starts, no hot-reload watcher overhead, no dev-mode error
   verbosity reaching end users.
3. **Near-zero-downtime swap**: start the new container on a spare port, health-check it, flip
   nginx's upstream, then retire the old container. Achievable with a slightly smarter deploy
   script — does not require an orchestrator (ECS/Kubernetes) at this scale.

### Phase 3 — hardening, as capacity allows

1. **Give nexus-crm its own dedicated Postgres**, separate from `goldbond-postgres`. This is the
   structural fix for §1's entire incident category — while the database is shared, nexus-crm's
   availability remains coupled to a system it doesn't control, audit, or schedule maintenance
   for. Higher-effort than the other phases, correctly deferred past the immediate deadline, but
   the single highest-leverage fix in this document for *why this kind of thing happens at all*.
2. **Tested restore procedure**, formalized and repeated periodically — not a one-time proof.
3. **Basic uptime monitoring** (even free-tier) on `/api/health` and the homepage, so the team
   learns about an outage before the client reports it.
4. **Real secrets management** (AWS SSM Parameter Store, or at minimum a small
   `rotate-db-password.sh` script that changes the database password, `.env`, and restarts the
   backend as one atomic action) — makes it structurally impossible to update one side of a
   shared credential without the other, which is the exact failure mode in §1.

---

## 5. Open items needing someone else's access

- **GitHub branch protection / `main` creation** (Phase 0, item 1) — needs repo admin/owner
  access, which the requester of this document has stated they do not currently hold. Raise with
  whoever owns the GitHub repo before Phase 0 can be considered complete.
- **TLS certificate chain fix** — explicitly out of scope here; owned by someone else per direct
  instruction. Cross-referenced in §2.4 only.

---

## 6. Sign-off

This document is a draft pending review. Once approved, Phase 0 items 2–6 (tagging, smoke test,
runbook rule, backup + restore test, deploy window) can be implemented directly over SSH with no
further architectural decisions needed. Phase 0 item 1 is blocked on §5.
