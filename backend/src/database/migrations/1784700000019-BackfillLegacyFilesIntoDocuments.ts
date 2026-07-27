import { MigrationInterface, QueryRunner } from "typeorm";

// Backfills every existing single-value file column into the generic
// documents table (see the previous migration), then drops those columns --
// companies.logo, employees.profile_photo_url, employees.s3_key (CV),
// employee_certifications.evidence_file_url. created_at/created_by are
// backfilled from each source row's own updated_at/updated_by as the closest
// available proxy for "when this file was actually set" (these columns
// never tracked that separately).
export class BackfillLegacyFilesIntoDocuments1784700000019 implements MigrationInterface {
  name = "BackfillLegacyFilesIntoDocuments1784700000019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "documents" (id, tenant_id, owner_type, owner_id, s3_key, created_at, created_by, updated_at, updated_by)
      SELECT uuid_generate_v4(), tenant_id, 'company_logo', id, logo, updated_at, updated_by, updated_at, updated_by
      FROM "companies" WHERE logo IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "documents" (id, tenant_id, owner_type, owner_id, s3_key, created_at, created_by, updated_at, updated_by)
      SELECT uuid_generate_v4(), tenant_id, 'employee_photo', id, profile_photo_url, updated_at, updated_by, updated_at, updated_by
      FROM "employees" WHERE profile_photo_url IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "documents" (id, tenant_id, owner_type, owner_id, s3_key, created_at, created_by, updated_at, updated_by)
      SELECT uuid_generate_v4(), tenant_id, 'employee_cv', id, s3_key, updated_at, updated_by, updated_at, updated_by
      FROM "employees" WHERE s3_key IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "documents" (id, tenant_id, owner_type, owner_id, s3_key, created_at, created_by, updated_at, updated_by)
      SELECT uuid_generate_v4(), tenant_id, 'certification_evidence', id, evidence_file_url, updated_at, updated_by, updated_at, updated_by
      FROM "employee_certifications" WHERE evidence_file_url IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "logo"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "profile_photo_url"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "s3_key"`);
    await queryRunner.query(`ALTER TABLE "employee_certifications" DROP COLUMN "evidence_file_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ADD "logo" character varying`);
    await queryRunner.query(`ALTER TABLE "employees" ADD "profile_photo_url" character varying`);
    await queryRunner.query(`ALTER TABLE "employees" ADD "s3_key" character varying`);
    await queryRunner.query(`ALTER TABLE "employee_certifications" ADD "evidence_file_url" character varying`);

    await queryRunner.query(`
      UPDATE "companies" c SET "logo" = d.s3_key FROM "documents" d
      WHERE d.owner_type = 'company_logo' AND d.owner_id = c.id AND d.deleted_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE "employees" e SET "profile_photo_url" = d.s3_key FROM "documents" d
      WHERE d.owner_type = 'employee_photo' AND d.owner_id = e.id AND d.deleted_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE "employees" e SET "s3_key" = d.s3_key FROM "documents" d
      WHERE d.owner_type = 'employee_cv' AND d.owner_id = e.id AND d.deleted_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE "employee_certifications" ec SET "evidence_file_url" = d.s3_key FROM "documents" d
      WHERE d.owner_type = 'certification_evidence' AND d.owner_id = ec.id AND d.deleted_at IS NULL
    `);

    // Clean up what this migration's up() inserted so the previous
    // migration's down() (which converts "documents" back into a
    // deal-only table) doesn't choke on leftover non-deal_document rows.
    await queryRunner.query(
      `DELETE FROM "documents" WHERE owner_type IN ('company_logo', 'employee_photo', 'employee_cv', 'certification_evidence')`,
    );
  }
}
