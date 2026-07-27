import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeTimestampsToTimestamptz1784700000015 implements MigrationInterface {
  name = "ChangeTimestampsToTimestamptz1784700000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tablesWithAudit = [
      "users",
      "rbac_roles",
      "rbac_resources",
      "teams",
      "industries",
      "plans",
      "tenants_registry",
      "relationship_types",
      "relationship_company_contact_map",
      "departments",
      "companies",
      "contacts",
      "employees",
      "main_stages",
      "sub_stages",
      "deal_sources",
      "deals",
      "deal_documents",
      "deal_reviews",
      "deal_tender_details",
      "reminders",
      "notifications",
    ];

    for (const table of tablesWithAudit) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE USING "created_at" AT TIME ZONE 'UTC'`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE USING "updated_at" AT TIME ZONE 'UTC'`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "deleted_at" TYPE TIMESTAMP WITH TIME ZONE USING "deleted_at" AT TIME ZONE 'UTC'`
      );
    }

    const tablesWithCreatedAtOnly = [
      "refresh_tokens",
      "rbac_role_user_map",
      "rbac_role_resource_map",
      "teams_employee_map",
      "deal_partners_map",
    ];

    for (const table of tablesWithCreatedAtOnly) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE USING "created_at" AT TIME ZONE 'UTC'`
      );
    }

    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "occurred_at" TYPE TIMESTAMP WITH TIME ZONE USING "occurred_at" AT TIME ZONE 'UTC'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tablesWithAudit = [
      "users",
      "rbac_roles",
      "rbac_resources",
      "teams",
      "industries",
      "plans",
      "tenants_registry",
      "relationship_types",
      "relationship_company_contact_map",
      "departments",
      "companies",
      "contacts",
      "employees",
      "main_stages",
      "sub_stages",
      "deal_sources",
      "deals",
      "deal_documents",
      "deal_reviews",
      "deal_tender_details",
      "reminders",
      "notifications",
    ];

    for (const table of tablesWithAudit) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "created_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "created_at" AT TIME ZONE 'UTC'`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "updated_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "updated_at" AT TIME ZONE 'UTC'`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "deleted_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "deleted_at" AT TIME ZONE 'UTC'`
      );
    }

    const tablesWithCreatedAtOnly = [
      "refresh_tokens",
      "rbac_role_user_map",
      "rbac_role_resource_map",
      "teams_employee_map",
      "deal_partners_map",
    ];

    for (const table of tablesWithCreatedAtOnly) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "created_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "created_at" AT TIME ZONE 'UTC'`
      );
    }

    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "occurred_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "occurred_at" AT TIME ZONE 'UTC'`
    );
  }
}
