import { MigrationInterface, QueryRunner } from "typeorm";

// New audit_logs table -- see CLAUDE.md's "Deeper audit trail" rule. An
// append-only record of significant mutations (who, what entity, when, what
// changed), separate from the per-row createdBy/updatedBy/deletedBy columns
// (which only ever show the *last* actor). Rolled out to individual services
// one table at a time -- this migration only creates the table itself.
export class CreateAuditLogs1784700000002 implements MigrationInterface {
  name = "CreateAuditLogs1784700000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "audit_logs_action_enum" AS ENUM ('insert', 'update', 'delete')
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "entity_type" character varying NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" "audit_logs_action_enum" NOT NULL,
        "actor_id" uuid,
        "occurred_at" TIMESTAMP NOT NULL DEFAULT now(),
        "changes" jsonb,
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
    // Not a FK to tenants_registry/users -- an audit log entry must survive
    // the tenant or user it references being deleted later (unlike
    // createdBy/deletedBy, which are live operational columns, this is a
    // historical record that should never be affected by ON DELETE
    // CASCADE/SET NULL rewriting it after the fact).
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_tenant" ON "audit_logs" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_tenant"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_entity"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "audit_logs_action_enum"`);
  }
}
