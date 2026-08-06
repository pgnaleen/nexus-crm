# ORELIA (Nexus CRM)

A multi-tenant B2B CRM. pnpm monorepo: `common` (shared types/enums), `backend` (NestJS + TypeORM + Postgres), `frontend` (Next.js 14).

Everything runs in Docker — you do **not** need Node or pnpm installed on your machine, only Docker.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose)
- Git

## First-time setup

1. **Clone the repo and check out the branch:**

   ```bash
   git clone https://github.com/pgnaleen/nexus-crm.git
   cd nexus-crm
   git checkout dev-g
   ```

2. **Create your env file:**

   ```bash
   cp .env.example .env
   ```

   The defaults in `.env.example` work as-is for local dev — no edits needed unless you want to change ports or secrets.

3. **Build and start everything:**

   ```bash
   docker compose up --build
   ```

   This starts `postgres`, a one-shot `setup` container (installs all workspace dependencies and builds `common` — this can take a few minutes on the first run, and it's supposed to exit once done, that's not an error), then `backend` (NestJS, port 3001) and `frontend` (Next.js, port 3000). Leave this running in its own terminal.

4. **Run the database migrations** (in a second terminal, once the containers are up):

   ```bash
   docker compose exec backend pnpm --filter @orelia/backend migration:run
   ```

5. **Seed the database** with a default tenant, admin user, plans, and industries:

   ```bash
   docker compose exec backend pnpm --filter @orelia/backend seed
   ```

6. **Open the app:** [http://localhost:3000/system](http://localhost:3000/system)

   Log in with the seeded admin account:
   - **Tenant slug:** `system`
   - **Username:** `admin`
   - **Password:** `ChangeMe123!`

## Everyday use

- **Start the app:** `docker compose up` (no `--build` needed unless `Dockerfile.dev` changed)
- **Stop it:** `Ctrl+C`, or `docker compose down` from another terminal
- **View logs for one service:** `docker compose logs -f backend` (or `frontend`, `postgres`)
- **Rebuild after pulling changes that touch `Dockerfile.dev`:** `docker compose up --build`

Both `backend` and `frontend` hot-reload automatically on file changes — you don't need to restart containers for normal code edits. Only `Dockerfile.dev` changes require a rebuild.

## Database migrations

Whenever you pull changes that include new migration files:

```bash
docker compose exec backend pnpm --filter @orelia/backend migration:run
```

To create a new migration after changing an entity:

```bash
docker compose exec backend pnpm --filter @orelia/backend migration:generate ./src/database/migrations/YourMigrationName
```

**Check the generated file before running it** — if you only changed one entity, the auto-generated migration may also include unrelated diffs (e.g. it doesn't know about hand-added foreign keys on `created_by`/`updated_by` columns, see `backend/src/core/audited.entity.ts` for why). Strip anything unrelated to your change before applying it.

## Project structure

```
common/    shared TypeScript types, enums, and API contracts (@orelia/common)
backend/   NestJS API — modules under src/modules/<name>/{entities,dto,*.controller.ts,*.service.ts}
frontend/  Next.js 14 App Router — src/app/[tenant]/(dashboard)/...
```

## Architecture

### Stack

| Layer      | Tech                                            | Port |
|------------|--------------------------------------------------|------|
| `frontend` | Next.js 14 (App Router), React 18, TanStack Query | 3000 |
| `backend`  | NestJS 10, TypeORM 0.3, class-validator, JWT/Passport | 3001 |
| `postgres` | PostgreSQL 16                                     | 5432 |
| `common`   | Shared TS package (types/enums/API contracts) — built once, imported by both apps, not a running service |

pnpm workspace monorepo, Node 20. Package manager pinned via `packageManager: pnpm@9.15.0` — Docker images use the same pin (`corepack prepare pnpm@9.15.0`).

### Containers

```
┌────────────┐   REST/JSON   ┌────────────┐    SQL    ┌────────────┐
│  frontend   │ ────────────▶ │  backend    │ ─────────▶ │  postgres   │
│  Next.js    │ ◀──────────── │  NestJS API │ ◀───────── │  Postgres16 │
│  :3000      │               │  :3001      │            │  :5432      │
└────────────┘               └────────────┘            └────────────┘
       ▲                             ▲
       └──────────────┬──────────────┘
                       │ waits on (service_completed_successfully)
               ┌───────────────┐
               │     setup      │  one-shot: pnpm install + build `common`
               │  (exits after) │  avoids a pnpm-store race if backend/frontend
               └───────────────┘  both tried to `pnpm install` at once
```

4 services are declared in `docker-compose.yml`; only 3 stay running long-term (`postgres`, `backend`, `frontend`). `setup` runs once per `docker compose up` and exits — that's expected, not a crash.

### Multi-tenancy

Every tenant-scoped table (users, roles, teams, deals, companies, contacts, etc.) extends `TenantOwnedEntity` → `AuditedTenantEntity` (adds `createdBy`/`updatedBy`/`deletedAt` — soft delete everywhere, no hard deletes). All reads/writes go through `BaseTenantRepository<T>` (`findScoped`/`findOneScoped`/`createScoped`/`saveScoped`), which enforces the tenant filter at the query level so one tenant's data is structurally unreachable from another's request — there's no per-endpoint "did I remember the WHERE clause" risk.

The ambient tenant for a request is resolved once by `TenantContextInterceptor` from the caller's JWT and exposed via `TenantContextService` for the rest of that request's lifetime. A dedicated **System** tenant hosts platform-level administrators (tenant management, cross-tenant "act as tenant" for support/setup).

### RBAC (permissions)

Permission keys (e.g. `users:create`, `roles:manage`, `deal_source:view`) are defined centrally in `common/src/constants/permissions.ts` and shared by both apps. They're stored per-role in `rbac_resources` / `rbac_role_resource_map`, checked on every protected route via `PermissionsGuard` + `@RequirePermission(...)`, and on the frontend via the session's `permissions: string[]` array (client-side checks are UX only — the backend guard is the actual boundary). Some resources are `isPlatformOnly` and can only ever be granted within the System tenant.

### Auth

JWT access + refresh tokens in httpOnly cookies; refresh rotation; login brute-force lockout (5 failed attempts → 15 min lock); CORS restricted to an explicit `CORS_ORIGIN` allow-list (credentialed requests are never wide-open).

### Module layout

```
backend/src/modules/<name>/
  entities/<name>.entity.ts
  dto/create-<name>.dto.ts, update-<name>.dto.ts
  <name>.repository.ts   # extends BaseTenantRepository<Entity>
  <name>.service.ts
  <name>.controller.ts   # routes gated by @RequirePermission(...)
  <name>.module.ts

frontend/src/app/[tenant]/(dashboard)/<section>/
  page.tsx                # server component: session + data fetch
  _components/<Section>Widget.tsx     # client component: table/list/search
  _components/<Section>FormDialog.tsx # client component: create/edit form
```

## Notes for your editor (VS Code, etc.)

Since dependencies live only inside Docker's named volumes (not on your host filesystem), your local editor's TypeScript server will show "Cannot find module" errors for things like `@nestjs/common`, `typeorm`, `@orelia/common`, etc. **This is expected and harmless** — the actual backend compiles and runs fine inside the container. If it bothers you, you can `pnpm install` on your host too (it won't conflict with the containers), but it isn't required to run the app.

## Rebuilding `common` after a shared-type change

`common` is built once by the `setup` service when the stack starts, not watched continuously. If you change something in `common/src/` and don't see it reflected in `backend`/`frontend`, rebuild it manually:

```bash
docker compose exec backend pnpm --filter @orelia/common build
```

## Deployment (production — sales.orelit.com)

### The live setup, as it actually exists

- **EC2** (Ubuntu) at `sales.orelit.com`, with **nginx** (native, terminating TLS) reverse-proxying `/` → `localhost:3000` (frontend) and `/api/` → `localhost:3001` (backend).
- **Database: AWS RDS Postgres** (`DB_HOST` points at the RDS endpoint; `DB_SSL=true` in the server's `.env`).
- The stack runs from **`~/nexus-crm/docker-compose.prod.yml`** — a **server-local file, not tracked in this repo**. It builds from `Dockerfile.dev` but the frontend runs a real `next build && next start`, with `NEXT_PUBLIC_API_URL: https://sales.orelit.com` and `API_INTERNAL_URL: http://backend:3001` set in the compose file itself.
- Secrets live in **`~/nexus-crm/.env` on the server** (plain file, gitignored, hand-maintained). Any credential shared with an external system (e.g. the RDS password) must be changed **on both sides in the same action**, then verified with a real login — see the postmortems in `docs/project/plans/PLANS.md`.

### Branch model

| Branch | Role |
|---|---|
| `dev-g` | Daily development. Pushing here **never** deploys anything. |
| `main`  | Production. The server only ever pulls `main`. Merging into it is the deliberate "this batch is client-ready" decision. |

### Releasing a new version (on your machine)

```bash
git checkout main
git merge --ff-only dev-g     # promote the current dev state
git push origin main
git checkout dev-g            # go back to daily work
```

If `--ff-only` refuses, `main` has something `dev-g` doesn't — investigate before forcing anything.

### Deploying (on the server)

One command — `deploy.sh` (tracked in this repo) is the entire runbook:

```bash
ssh ubuntu@<server>
cd ~/nexus-crm
./deploy.sh          # deploys main
```

What it does, in order — and it **fails loudly** if any step breaks:
1. `git pull` of `main` (or `./deploy.sh <branch>` to override — avoid).
2. Tags the deploy (`deploy-YYYY-MM-DD-HHMM`) so rollback is unambiguous.
3. `docker compose -f docker-compose.prod.yml up -d --build` — always the prod compose file.
4. Runs database migrations, then the **idempotent** seed (registers any newly-added RBAC permission keys; never resets existing users or passwords).
5. Waits for the frontend's in-container `next build` to finish (takes a few minutes), then smoke-tests the site **and** a fake API login — `401` proves the whole nginx → backend → RDS → auth chain; anything else fails the deploy.

Expect a brief interruption during the rebuild — deploy in the agreed low-traffic window.

### Rolling back

```bash
cd ~/nexus-crm
git tag --list 'deploy-*' | tail -5      # find the last-good tag
git checkout <previous-deploy-tag>
docker compose -f docker-compose.prod.yml up -d --build
```

(If a bad migration changed data, restore the RDS snapshot/backup taken before the deploy — code rollback alone doesn't undo schema/data changes.)

### ⚠️ The one command that must never run on the server

```bash
docker compose up -d --build        # ← NO. This is the DEV compose file.
```

Running the default `docker-compose.yml` on the server silently deploys the **development** config: `next dev`, and `NEXT_PUBLIC_API_URL=http://localhost:3001` baked into the browser bundle — every visitor's browser then calls its own machine and login dies with "Failed to fetch". This exact incident happened on 2026-07-23. Both compose files share a project name, so `docker compose -f docker-compose.prod.yml ps` will happily show the wrongly-created containers as if everything were fine. **Always deploy through `./deploy.sh`.**

### Hardening roadmap

Environment separation (staging), CI/CD, real production Dockerfiles, a dedicated smoke-tested backup/restore drill, and secrets management are planned and prioritized in `docs/project/plans/PLANS.md` — including postmortems of the incidents that motivated each phase.

## Troubleshooting

**`Bind for 0.0.0.0:3001 failed: port is already allocated`**
Something's already using that port — usually a leftover container from an earlier attempt. Run:
```bash
docker compose down
docker compose up --build
```
If it still happens, check `docker ps -a` for another container (from this project or something else) holding port 3000/3001/5432.

**`no configuration file provided: not found`**
You ran `docker compose ...` from the wrong folder. It only works from inside `nexus-crm/` (where `docker-compose.yml` lives) — `cd nexus-crm` first.

**`ERR_PNPM_ENOENT ... copyfile ... .pnpm-store ...`**
This was a real race condition on a fresh clone (two containers running `pnpm install` into the same store at once) — fixed by the dedicated `setup` service described above, which both `backend` and `frontend` now wait to *finish* before starting. If you still hit it (e.g. on an old checkout from before this fix), run:
```bash
docker compose down
rm -rf .pnpm-store
docker compose up --build
```
