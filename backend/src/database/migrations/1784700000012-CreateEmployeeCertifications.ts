import { MigrationInterface, QueryRunner } from "typeorm";

// Story 1.12 (Self-Report a Certification) -- employee_certifications, one
// row per claimed certification (many per employee). status drives the
// Pending -> Verified/Rejected lifecycle; verified_by_id/verified_at/
// rejection_reason are filled by HR review in Story 1.13.
export class CreateEmployeeCertifications1784700000012 implements MigrationInterface {
  name = "CreateEmployeeCertifications1784700000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."employee_certifications_status_enum" AS ENUM('pending', 'verified', 'rejected')`,
    );

    await queryRunner.query(`
      CREATE TABLE "employee_certifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        "employee_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "issuing_organization" character varying NOT NULL,
        "credential_id" character varying,
        "issue_date" date NOT NULL,
        "expiry_date" date,
        "evidence_file_url" character varying,
        "evidence_link" character varying,
        "status" "public"."employee_certifications_status_enum" NOT NULL DEFAULT 'pending',
        "verified_by_id" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "rejection_reason" text,
        CONSTRAINT "PK_employee_certifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "employee_certifications" ADD CONSTRAINT "FK_employee_certifications_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_certifications" ADD CONSTRAINT "FK_employee_certifications_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_certifications" ADD CONSTRAINT "FK_employee_certifications_verified_by"
      FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_certifications" ADD CONSTRAINT "FK_employee_certifications_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_certifications" ADD CONSTRAINT "FK_employee_certifications_updated_by"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_certifications" ADD CONSTRAINT "FK_employee_certifications_deleted_by"
      FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Story 1.12 lists an employee's own certs; Story 1.13's review queue and
    // Story 1.14's search filter by tenant + status.
    await queryRunner.query(`
      CREATE INDEX "IDX_employee_certifications_tenant_employee"
      ON "employee_certifications" ("tenant_id", "employee_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_employee_certifications_tenant_status"
      ON "employee_certifications" ("tenant_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_employee_certifications_tenant_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_employee_certifications_tenant_employee"`);
    await queryRunner.query(
      `ALTER TABLE "employee_certifications" DROP CONSTRAINT "FK_employee_certifications_deleted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_certifications" DROP CONSTRAINT "FK_employee_certifications_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_certifications" DROP CONSTRAINT "FK_employee_certifications_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_certifications" DROP CONSTRAINT "FK_employee_certifications_verified_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_certifications" DROP CONSTRAINT "FK_employee_certifications_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_certifications" DROP CONSTRAINT "FK_employee_certifications_tenant"`,
    );
    await queryRunner.query(`DROP TABLE "employee_certifications"`);
    await queryRunner.query(`DROP TYPE "public"."employee_certifications_status_enum"`);
  }
}
