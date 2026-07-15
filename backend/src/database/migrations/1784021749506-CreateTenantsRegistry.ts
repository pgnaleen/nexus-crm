import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenantsRegistry1784021749506 implements MigrationInterface {
    name = 'CreateTenantsRegistry1784021749506'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tenants_registry_status_enum" AS ENUM('active', 'trial', 'suspended', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "tenants_registry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "tagline" character varying, "plan_id" uuid NOT NULL, "status" "public"."tenants_registry_status_enum" NOT NULL DEFAULT 'trial', "industry_id" uuid, "phone_no" character varying, "contact_email" character varying, "billing_email" character varying, "address" character varying, "trial_ends" date, "notes" text, "extras" text, "asset" character varying, CONSTRAINT "UQ_50a8cc6dd05989d5e4f9710ad24" UNIQUE ("slug"), CONSTRAINT "PK_f7c70465b1131176a08de1b6524" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD CONSTRAINT "FK_c9773c0989fad55f2e215e4e94e" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD CONSTRAINT "FK_3408d486af218f37bcd1c86e35e" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP CONSTRAINT "FK_3408d486af218f37bcd1c86e35e"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP CONSTRAINT "FK_c9773c0989fad55f2e215e4e94e"`);
        await queryRunner.query(`DROP TABLE "tenants_registry"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_registry_status_enum"`);
    }

}
