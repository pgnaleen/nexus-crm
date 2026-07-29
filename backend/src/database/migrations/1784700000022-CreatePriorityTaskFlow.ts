import { MigrationInterface, QueryRunner } from "typeorm";

// Epic 3, Story 3.1. Introduces priority_task_flow, the append-only
// replacement for priority_tasks' own owner_id/quadrant/rank/status/
// delegated_to_user_id/delegated_by_user_id columns and the whole
// priority_task_delegation_trackers table, then backfills it from every
// existing task's audit_logs trail so no history is lost.
//
// This migration ONLY adds the new table and backfills it -- it does not
// touch priority_tasks' old columns or drop priority_task_delegation_
// trackers. Story 3.2 cuts the service layer over to read/write flow
// exclusively and, once that's verified live, drops the old columns/table
// in its own follow-up migration. Running both in one step would leave no
// way to compare the new table's output against the still-live old columns
// while verifying the backfill.
//
// NOTE for Story 3.2: this backfill reconstructs ownership/lifecycle hops
// only (placed/delegated/accepted/completed/archived/restored). It does
// NOT emit a flow row per progress update -- progress is a mutable field on
// the current row, not a hop (see the entity's own comment on why). That
// means Story 1.9's "Progress updated" history entries cannot come from
// flow alone; Story 3.2 needs to decide whether the timeline keeps merging
// those in from audit_logs (which still records every one, untouched) or
// drops granular progress history as an accepted scope change.
export class CreatePriorityTaskFlow1784700000022 implements MigrationInterface {
  name = "CreatePriorityTaskFlow1784700000022";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."priority_task_flow_event_type_enum" AS ENUM(
        'placed', 'delegated', 'accepted', 'completed', 'archived', 'restored'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "priority_task_flow" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "seq" integer NOT NULL,
        "event_type" "public"."priority_task_flow_event_type_enum" NOT NULL,
        "linked_user_id" uuid,
        "quadrant" "public"."priority_tasks_quadrant_enum",
        "rank" integer,
        "progress" integer NOT NULL DEFAULT 0,
        "is_current" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_priority_task_flow_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_priority_task_flow_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "priority_task_flow" ADD CONSTRAINT "FK_priority_task_flow_task"
      FOREIGN KEY ("task_id") REFERENCES "priority_tasks"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_flow" ADD CONSTRAINT "FK_priority_task_flow_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_flow" ADD CONSTRAINT "FK_priority_task_flow_linked_user"
      FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_flow" ADD CONSTRAINT "FK_priority_task_flow_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_priority_task_flow_task_user" ON "priority_task_flow" ("task_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_priority_task_flow_linked_user" ON "priority_task_flow" ("linked_user_id")
    `);

    // The invariant that makes the old duplicate-tracker bug structurally
    // impossible: at most one is_current row per (task_id, user_id), ever.
    // A partial index has no TypeORM decorator equivalent, hence raw DDL.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_priority_task_flow_current_per_user"
      ON "priority_task_flow" ("task_id", "user_id")
      WHERE "is_current"
    `);

    await this.backfill(queryRunner);
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    const tasks: TaskRow[] = await queryRunner.query(`
      SELECT id, owner_id, quadrant, rank, status, progress,
             delegated_to_user_id, delegated_by_user_id, created_by, deleted_at
      FROM priority_tasks
    `);

    let totalRows = 0;
    let flaggedStale = 0;

    for (const task of tasks) {
      const auditRows: AuditRow[] = await queryRunner.query(
        `SELECT action, actor_id, occurred_at, changes FROM audit_logs
         WHERE entity_type = 'priority_task' AND entity_id = $1
         ORDER BY occurred_at ASC`,
        [task.id],
      );

      const drafts = reconstructFlow(task, auditRows);
      if (drafts.length === 0) {
        // No audit trail at all (shouldn't happen -- create() always writes
        // an insert row -- but a bare fallback keeps the migration from
        // silently dropping a task with a gap in its audit history).
        drafts.push({
          userId: task.owner_id,
          eventType: task.status === "delegated" ? "delegated" : mapStatusToEventType(task.status),
          linkedUserId: task.status === "delegated" ? task.delegated_to_user_id : null,
          quadrant: task.quadrant,
          rank: task.rank,
        });
      }

      // Last row per user wins as the current one; every earlier row for
      // that same user on this task is superseded. This single rule is what
      // retroactively cleans the historical duplicate-tracker bug out of
      // existing data -- a stale early "delegated" row is, by construction,
      // never the last row for that user unless it genuinely still is.
      const lastIndexByUser = new Map<string, number>();
      drafts.forEach((draft, index) => lastIndexByUser.set(draft.userId, index));

      const taskIsGone = task.deleted_at !== null;

      for (const [i, draft] of drafts.entries()) {
        const seq = i + 1;
        let isCurrent = !taskIsGone && lastIndexByUser.get(draft.userId) === i;

        let quadrant = draft.quadrant;
        let rank = draft.rank;
        let progress = 0;
        let linkedUserId = draft.linkedUserId;

        // Safety net: overwrite the row that ends up representing the
        // task's live owner with the authoritative current columns, in case
        // reconstruction drifted from an audit entry that didn't carry a
        // field (e.g. accept() never recorded rank).
        if (isCurrent && draft.userId === task.owner_id && !taskIsGone) {
          quadrant = task.quadrant;
          rank = task.rank;
          progress = task.progress;
          if (task.status === "delegated") {
            linkedUserId = task.delegated_to_user_id;
          }
        }

        if (!isCurrent && lastIndexByUser.get(draft.userId) === i && taskIsGone) {
          flaggedStale++;
        }

        await queryRunner.query(
          `INSERT INTO priority_task_flow
             (task_id, user_id, seq, event_type, linked_user_id, quadrant, rank, progress, is_current, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            task.id,
            draft.userId,
            seq,
            draft.eventType,
            linkedUserId,
            quadrant,
            rank,
            progress,
            isCurrent,
            task.owner_id,
          ],
        );
        totalRows++;
      }
    }

    console.log(
      `[CreatePriorityTaskFlow] backfilled ${totalRows} flow row(s) across ${tasks.length} task(s); ` +
        `${flaggedStale} row(s) on soft-deleted tasks forced is_current=false.`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_priority_task_flow_current_per_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_task_flow_linked_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_task_flow_task_user"`);
    await queryRunner.query(`ALTER TABLE "priority_task_flow" DROP CONSTRAINT "FK_priority_task_flow_created_by"`);
    await queryRunner.query(`ALTER TABLE "priority_task_flow" DROP CONSTRAINT "FK_priority_task_flow_linked_user"`);
    await queryRunner.query(`ALTER TABLE "priority_task_flow" DROP CONSTRAINT "FK_priority_task_flow_user"`);
    await queryRunner.query(`ALTER TABLE "priority_task_flow" DROP CONSTRAINT "FK_priority_task_flow_task"`);
    await queryRunner.query(`DROP TABLE "priority_task_flow"`);
    await queryRunner.query(`DROP TYPE "public"."priority_task_flow_event_type_enum"`);
  }
}

interface TaskRow {
  id: string;
  owner_id: string;
  quadrant: string;
  rank: number;
  status: string;
  progress: number;
  delegated_to_user_id: string | null;
  delegated_by_user_id: string | null;
  created_by: string | null;
  deleted_at: string | null;
}

interface AuditRow {
  action: "insert" | "update" | "delete";
  actor_id: string | null;
  occurred_at: string;
  changes: Record<string, unknown> | null;
}

interface FlowDraft {
  userId: string;
  eventType: string;
  linkedUserId: string | null;
  quadrant: string | null;
  rank: number | null;
}

function mapStatusToEventType(status: string): string {
  if (status === "completed") return "completed";
  if (status === "archived") return "archived";
  if (status === "accepted") return "accepted";
  return "placed";
}

// Walks one task's audit_logs trail oldest-first and reconstructs the
// sequence of custody hops. Mirrors, in reverse, the exact `changes` shapes
// each service method already writes (see priority-tasks.service.ts's
// create/delegate/accept/redelegate/complete/archive/restore) -- this is
// the read side of that same contract, not a new one.
function reconstructFlow(task: TaskRow, auditRows: AuditRow[]): FlowDraft[] {
  const drafts: FlowDraft[] = [];
  let currentOwner: string | null = task.created_by ?? task.owner_id;
  let lastQuadrant: string | null = task.quadrant;
  let lastRank: number | null = task.rank;

  const openDelegation = (): FlowDraft | undefined =>
    [...drafts].reverse().find((d) => d.eventType === "delegated");

  for (const row of auditRows) {
    const changes = row.changes ?? {};
    const actorId: string | null = row.actor_id ?? currentOwner;

    if (row.action === "insert") {
      currentOwner = actorId;
      lastQuadrant = asString(changes.quadrant) ?? task.quadrant;
      lastRank = asNumber(changes.rank) ?? task.rank;
      drafts.push({ userId: currentOwner!, eventType: "placed", linkedUserId: null, quadrant: lastQuadrant, rank: lastRank });
      continue;
    }

    if (row.action === "delete") {
      break; // remove() is terminal -- nothing after it is reachable.
    }

    // action === "update"
    const statusChange = changes.status as { old?: string; new?: string } | undefined;

    if (statusChange?.new === "delegated") {
      const target = getChangedTo(changes.delegatedToUserId);
      drafts.push({ userId: actorId!, eventType: "delegated", linkedUserId: target, quadrant: "delegate", rank: null });
      continue;
    }

    if (statusChange?.new === "accepted") {
      const prevOwner = getChangedFrom(changes.ownerId);
      lastQuadrant = asString(changes.quadrant) ?? lastQuadrant;
      drafts.push({ userId: actorId!, eventType: "accepted", linkedUserId: prevOwner, quadrant: lastQuadrant, rank: null });
      currentOwner = actorId;
      continue;
    }

    if (statusChange?.old === "archived" && statusChange?.new === "placed") {
      // No distinct "restored" flow event type -- a restore writes a plain
      // "placed" row, same as the live restore() will (see the enum's own
      // comment). "Restored" survives only as a PriorityTaskHistoryEntry
      // kind, derived from audit_logs, not from this table.
      drafts.push({ userId: currentOwner!, eventType: "placed", linkedUserId: null, quadrant: lastQuadrant, rank: null });
      continue;
    }

    if (statusChange?.new === "completed") {
      drafts.push({ userId: currentOwner!, eventType: "completed", linkedUserId: null, quadrant: lastQuadrant, rank: lastRank });
      continue;
    }

    if (statusChange?.new === "archived") {
      drafts.push({ userId: currentOwner!, eventType: "archived", linkedUserId: null, quadrant: lastQuadrant, rank: lastRank });
      continue;
    }

    if ("delegatedToUserId" in changes && !statusChange) {
      // redelegate() -- a still-pending recipient passes it on without
      // accepting. No new hop for the original delegator; their existing
      // open "delegated" draft just points at the new target instead.
      const target = getChangedTo(changes.delegatedToUserId);
      const open = openDelegation();
      if (open) open.linkedUserId = target;
      continue;
    }

    // Anything else (notes/progress-only updates) isn't a custody hop --
    // skipped here; see this file's top-level note on progress history.
  }

  return drafts;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getChangedTo(value: unknown): string | null {
  if (value && typeof value === "object" && "new" in value) {
    const v = (value as { new?: unknown }).new;
    return typeof v === "string" ? v : null;
  }
  return null;
}

function getChangedFrom(value: unknown): string | null {
  if (value && typeof value === "object" && "old" in value) {
    const v = (value as { old?: unknown }).old;
    return typeof v === "string" ? v : null;
  }
  return null;
}
