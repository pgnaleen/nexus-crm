import { MigrationInterface, QueryRunner } from "typeorm";

// One row per (tenant, user), upserted in place -- see the entity's own
// comment. jsonb columns since layout/visibleWidgetKeys are opaque arrays
// the frontend owns the shape of (DashboardLayoutItem[] / string[]),
// matching the jsonb precedent already used for company/contact/deal
// metadata columns.
export class CreateDashboardPreferences1784700000038 implements MigrationInterface {
  name = "CreateDashboardPreferences1784700000038";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dashboard_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "visible_widget_keys" jsonb NOT NULL,
        "layout" jsonb NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" TIMESTAMPTZ,
        "deleted_by" uuid,
        CONSTRAINT "PK_dashboard_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dashboard_preferences_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dashboard_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_dashboard_preferences_tenant_user" ON "dashboard_preferences" ("tenant_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dashboard_preferences"`);
  }
}
