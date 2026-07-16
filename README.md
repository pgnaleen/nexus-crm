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

## Deployment (AWS EC2)

### Important caveat first

`docker-compose.yml` + `Dockerfile.dev` as they exist today are a **development** setup: they bind-mount the entire repo into the containers and run `nest start --watch` / `next dev` (unoptimized, hot-reload, verbose). They will technically run on an EC2 box, but you'd be shipping source code and dev servers to production with default secrets (`JWT_ACCESS_SECRET=change-me-access-secret`, DB password `orelia`). Fine for a quick demo behind a security group only you can reach; **not** fine for anything real. The steps below cover both.

### Recommended production topology

- **1 EC2 instance** (Ubuntu 22.04 LTS, `t3.medium` or larger — Node + Postgres + Next.js build all want headroom) running Docker.
- **Reverse proxy** (Nginx or Caddy) in front of `frontend`/`backend`, terminating TLS. Only **80/443** (and 22 for SSH, restricted to your IP) open in the security group — **3000/3001/5432 should never be exposed to the internet directly**.
- **Postgres**: a container with an EBS-backed volume is fine to start; move to **RDS** once this is real (automated backups, patching, no single point of failure on the same instance as the app).

### Step-by-step

1. **Launch the instance** — Ubuntu 22.04, attach/size the root EBS volume with the Postgres data volume in mind.
2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # log out/in after this
   ```
3. **Clone the repo and set a production `.env`:**
   ```bash
   git clone https://github.com/pgnaleen/nexus-crm.git
   cd nexus-crm
   git checkout dev-g   # or your release branch
   cp .env.example .env
   ```
   Then edit `.env` — **do not deploy with the example values**:
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate real ones: `openssl rand -hex 32`
   - `DB_PASSWORD` — a real password, not `orelia`
   - `CORS_ORIGIN` — your actual domain, e.g. `https://crm.yourcompany.com`
   - `NEXT_PUBLIC_API_URL` — the public URL the browser will call, e.g. `https://crm.yourcompany.com/api`
   - `NODE_ENV=production`
4. **Build for production, not dev mode.** `Dockerfile.dev` skips `pnpm build` entirely (it just runs the dev server against your mounted source). For production you want a multi-stage build that runs `pnpm build` and ships only the compiled output — no bind-mounted source, no `--watch`. Minimal example (`backend/Dockerfile`):
   ```dockerfile
   FROM node:20-bookworm-slim AS build
   RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
   WORKDIR /app
   COPY . .
   RUN pnpm install --frozen-lockfile \
       && pnpm --filter @orelia/common build \
       && pnpm --filter @orelia/backend build

   FROM node:20-bookworm-slim
   RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
   WORKDIR /app
   COPY --from=build /app .
   ENV NODE_ENV=production
   CMD ["node", "backend/dist/main"]
   ```
   `frontend/Dockerfile` follows the same shape, ending in `CMD ["pnpm", "--filter", "@orelia/frontend", "start"]` after `next build`. Wire these into a `docker-compose.prod.yml` (same `postgres`/`backend`/`frontend` services as today, minus the `setup` container, `Dockerfile.dev` reference, and source bind-mounts — build args/image tags instead). Treat this as a starting template, not drop-in production config — review it before relying on it.
5. **Bring the stack up, then run migrations and seed once:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec backend pnpm --filter @orelia/backend migration:run
   docker compose -f docker-compose.prod.yml exec backend pnpm --filter @orelia/backend seed   # first deploy only
   ```
6. **Put a reverse proxy + TLS in front.** Point your domain's A record at the instance's Elastic IP, then either:
   - **Caddy** (simplest — auto-provisions Let's Encrypt certs): a `Caddyfile` reverse-proxying `crm.yourcompany.com` → `localhost:3000` (and `/api/*` → `localhost:3001`) is normally 3–4 lines.
   - **Nginx + certbot**: standard `server { }` block proxying the same two upstreams, then `certbot --nginx`.
7. **Redeploying after changes:** `git pull`, then `docker compose -f docker-compose.prod.yml up -d --build`. A CI/CD pipeline (GitHub Actions building images and deploying over SSH, or pushing to ECR) is a natural next step once this is running for real — not required to get started.

### Security checklist before going live

- [ ] Real `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (not the `.env.example` defaults)
- [ ] Real DB password
- [ ] `CORS_ORIGIN` set to your actual domain only
- [ ] TLS in front (never serve login/cookies over plain HTTP)
- [ ] Security group closes 3000/3001/5432 to the internet — only 80/443 (+22 to your IP) open
- [ ] `NODE_ENV=production`
- [ ] Postgres backups — either RDS, or a cron'd `pg_dump` off-instance if staying on a container
- [ ] Elastic IP (or Route 53 + ALB) so the instance's address doesn't change under you

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
