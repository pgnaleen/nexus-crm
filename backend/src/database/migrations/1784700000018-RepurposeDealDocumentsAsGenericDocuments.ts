import { MigrationInterface, QueryRunner } from "typeorm";

// Repurposes the existing deal_documents table into a single generic
// "documents" store for every file attachment in the app (deal documents,
// certification evidence, employee photo/CV, company logo) rather than
// creating a brand-new table -- deal_documents already had almost the exact
// shape needed (id/audit columns, doc_type, title, s3_key), it just assumed
// every row belonged to a Deal. This adds a polymorphic owner_type +
// owner_id pair (same pattern as AuditLog.entityType/entityId) in place of
// the deal-only FK, and a tenant_id column of its own -- deal_documents
// previously had no tenant_id, relying entirely on the parent Deal's own
// tenant scoping, which no longer works once a row can belong to a Company/
// Employee/EmployeeCertification instead. See documents.service.ts for the
// per-owner-type replace/soft-delete policy this enables.
export class RepurposeDealDocumentsAsGenericDocuments1784700000018 implements MigrationInterface {
  name = "RepurposeDealDocumentsAsGenericDocuments1784700000018";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deal_documents" RENAME TO "documents"`);
    await queryRunner.query(
      `ALTER TABLE "documents" RENAME CONSTRAINT "FK_deal_documents_deleted_by" TO "FK_documents_deleted_by"`,
    );
    await queryRunner.query(`ALTER TYPE "deal_documents_doc_type_enum" RENAME TO "documents_doc_type_enum"`);

    await queryRunner.query(
      `CREATE TYPE "documents_owner_type_enum" AS ENUM ('company_logo', 'employee_photo', 'employee_cv', 'deal_document', 'certification_evidence')`,
    );
    await queryRunner.query(`ALTER TABLE "documents" ADD "owner_type" "documents_owner_type_enum"`);
    // Every existing row (this table's only rows so far) was a deal document.
    await queryRunner.query(`UPDATE "documents" SET "owner_type" = 'deal_document'`);
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "owner_type" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_0628e743f690f50e1fda36e6f2b"`);
    await queryRunner.query(`ALTER TABLE "documents" RENAME COLUMN "deal_id" TO "owner_id"`);

    // title/doc_type were NOT NULL under the deal-only shape; only
    // deal_document rows use either going forward (logo/photo/CV/evidence
    // need neither).
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "title" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "doc_type" DROP NOT NULL`);

    await queryRunner.query(`ALTER TABLE "documents" ADD "tenant_id" uuid`);
    await queryRunner.query(`
      UPDATE "documents" d SET "tenant_id" = deals.tenant_id
      FROM "deals" WHERE deals.id = d."owner_id" AND d."owner_type" = 'deal_document'
    `);
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "tenant_id" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_documents_tenant_owner" ON "documents" ("tenant_id", "owner_type", "owner_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_documents_tenant_owner"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_tenant"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "tenant_id"`);

    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "doc_type" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "title" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "documents" RENAME COLUMN "owner_id" TO "deal_id"`);
    await queryRunner.query(`
      ALTER TABLE "documents" ADD CONSTRAINT "FK_0628e743f690f50e1fda36e6f2b"
      FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "owner_type"`);
    await queryRunner.query(`DROP TYPE "documents_owner_type_enum"`);

    await queryRunner.query(`ALTER TYPE "documents_doc_type_enum" RENAME TO "deal_documents_doc_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "documents" RENAME CONSTRAINT "FK_documents_deleted_by" TO "FK_deal_documents_deleted_by"`,
    );
    await queryRunner.query(`ALTER TABLE "documents" RENAME TO "deal_documents"`);
  }
}
