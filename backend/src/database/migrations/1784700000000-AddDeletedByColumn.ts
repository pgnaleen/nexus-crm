import { MigrationInterface, QueryRunner } from "typeorm";

// Adds deleted_by (nullable uuid, FK to users(id) ON DELETE SET NULL, added by
// hand rather than generated -- same reason createdBy/updatedBy's FKs are
// hand-added, see the comment on AuditedEntity) to every table extending
// AuditedEntity/AuditedTenantEntity. Hand-written rather than using the raw
// `migration:generate` output, which mixed in unrelated FK/CHECK-constraint
// rename noise on other tables (a known drift-detection issue with this
// codebase's hand-added constraints not being modelled in decorators).
const TABLES = [
  "industries",
  "plans",
  "tenants_registry",
  "main_stages",
  "deal_sources",
  "departments",
  "employees",
  "companies",
  "contacts",
  "teams",
  "relationship_types",
  "reminders",
  "rbac_resources",
  "relationship_company_contact_map",
  "rbac_roles",
  "sub_stages",
  "deals",
  "notifications",
  "deal_tender_details",
  "deal_reviews",
  "deal_documents",
];

export class AddDeletedByColumn1784700000000 implements MigrationInterface {
  name = "AddDeletedByColumn1784700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "deleted_by" uuid`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_deleted_by" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES.slice().reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_deleted_by"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "deleted_by"`);
    }
  }
}
