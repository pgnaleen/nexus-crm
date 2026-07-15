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

## Notes for your editor (VS Code, etc.)

Since dependencies live only inside Docker's named volumes (not on your host filesystem), your local editor's TypeScript server will show "Cannot find module" errors for things like `@nestjs/common`, `typeorm`, `@orelia/common`, etc. **This is expected and harmless** — the actual backend compiles and runs fine inside the container. If it bothers you, you can `pnpm install` on your host too (it won't conflict with the containers), but it isn't required to run the app.

## Rebuilding `common` after a shared-type change

`common` is built once by the `setup` service when the stack starts, not watched continuously. If you change something in `common/src/` and don't see it reflected in `backend`/`frontend`, rebuild it manually:

```bash
docker compose exec backend pnpm --filter @orelia/common build
```

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
