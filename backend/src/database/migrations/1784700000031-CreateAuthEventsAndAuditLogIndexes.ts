import { MigrationInterface, QueryRunner } from "typeorm";

// Part of spec-activity-log.md ("Activity Log — System Administration page").
// Two things in one migration since they're both prerequisites for the same
// feature: a new auth_events table (login activity has never been recorded
// at all), and the audit_logs indexes the Activity Log page's queries need
// (today only (entity_type, entity_id) and (tenant_id) exist -- every
// date-ranged/actor/module query would table-scan).
export class CreateAuthEventsAndAuditLogIndexes1784700000031 implements MigrationInterface {
  name = "CreateAuthEventsAndAuditLogIndexes1784700000031";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- auth_events ---
    // Deliberately its own table, not folded into audit_logs -- see the
    // spec's design section A for the full reasoning. Two facts settle it:
    // audit_logs.entity_id is uuid NOT NULL (a failed login for an unknown
    // username has no user id), and login() runs on a @Public() route before
    // any tenant context exists, so every row would land with tenant_id NULL
    // (invisible under own-tenant scoping) unless tenantId is threaded
    // through explicitly -- which is exactly what AuthEventService.record()
    // does, unlike AuditLogService.
    //
    // No foreign keys -- mirrors audit_logs' own deliberate no-FK stance so a
    // row survives deletion of the user or tenant it references.
    await queryRunner.query(`
      CREATE TYPE "auth_events_event_type_enum" AS ENUM ('login_succeeded', 'login_failed', 'logout', 'account_locked')
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid,
        "username_attempted" character varying(255) NOT NULL,
        "event_type" "auth_events_event_type_enum" NOT NULL,
        "reason" character varying(32),
        "ip_address" character varying(45),
        "user_agent" character varying(512),
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_events_tenant_occurred" ON "auth_events" ("tenant_id", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_events_tenant_user_occurred" ON "auth_events" ("tenant_id", "user_id", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_events_tenant_type_occurred" ON "auth_events" ("tenant_id", "event_type", "occurred_at" DESC)
    `);

    // --- audit_logs indexes ---
    // IDX_audit_logs_tenant (tenant_id) dropped: it's a strict prefix of the
    // new (tenant_id, occurred_at DESC) index below, so keeping both is pure
    // write overhead on a table every mutation in the app writes to.
    // IDX_audit_logs_entity (entity_type, entity_id) is kept as-is -- it
    // still serves AuditLogService.findForEntity()/PriorityTasksService.getHistory().
    // `action` is deliberately in no index (three distinct values makes it a
    // heap predicate, not a selective key). No trigram/GIN index on `changes`
    // in this migration either -- see the spec's own note: ship free-text as
    // a plain ILIKE on top of the mandatory date range first, add a trigram
    // index later ONLY if EXPLAIN ANALYZE on real volume shows it's actually
    // needed.
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_tenant"`);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_tenant_occurred" ON "audit_logs" ("tenant_id", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_tenant_actor_occurred" ON "audit_logs" ("tenant_id", "actor_id", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_tenant_entity_type_occurred" ON "audit_logs" ("tenant_id", "entity_type", "occurred_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_tenant_entity_type_occurred"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_tenant_actor_occurred"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_tenant_occurred"`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_tenant" ON "audit_logs" ("tenant_id")`);

    await queryRunner.query(`DROP INDEX "IDX_auth_events_tenant_type_occurred"`);
    await queryRunner.query(`DROP INDEX "IDX_auth_events_tenant_user_occurred"`);
    await queryRunner.query(`DROP INDEX "IDX_auth_events_tenant_occurred"`);
    await queryRunner.query(`DROP TABLE "auth_events"`);
    await queryRunner.query(`DROP TYPE "auth_events_event_type_enum"`);
  }
}
