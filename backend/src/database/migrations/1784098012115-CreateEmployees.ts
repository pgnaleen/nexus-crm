import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmployees1784098012115 implements MigrationInterface {
    name = 'CreateEmployees1784098012115'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."employees_gender_enum" AS ENUM('male', 'female', 'other', 'prefer_not_to_say')`);
        await queryRunner.query(`CREATE TYPE "public"."employees_employment_type_enum" AS ENUM('full_time', 'part_time', 'contract', 'intern', 'temporary')`);
        await queryRunner.query(`CREATE TYPE "public"."employees_employment_status_enum" AS ENUM('active', 'on_leave', 'terminated', 'resigned')`);
        await queryRunner.query(`CREATE TYPE "public"."employees_clearance_level_enum" AS ENUM('public', 'internal', 'confidential', 'restricted')`);
        await queryRunner.query(`CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "employee_code" character varying, "title" character varying, "full_name" character varying NOT NULL, "date_of_birth" date, "gender" "public"."employees_gender_enum", "nationality" character varying, "current_designation" character varying, "department_id" uuid, "reporting_manager_id" uuid, "employment_type" "public"."employees_employment_type_enum", "employment_status" "public"."employees_employment_status_enum", "date_of_joined" date, "date_of_exit" date, "primary_location" character varying, "base_country" character varying, "clearance_level" "public"."employees_clearance_level_enum", "bio" text, "profile_photo_url" character varying, "cv_last_updated" TIMESTAMP WITH TIME ZONE, "nic_passport_number" text, "nic_passport_encrypted" boolean NOT NULL DEFAULT false, "s3_key" character varying, "base_salary" numeric(12,2), "user_id" uuid, "employee_email" character varying, "mobile_no" character varying, "office_no" character varying, CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_588d18aeef0504067e40c682788" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_678a3540f843823784b0fe4a4f2" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_d9905573bc2ac40a295320325cf" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_d9905573bc2ac40a295320325cf"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_678a3540f843823784b0fe4a4f2"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_588d18aeef0504067e40c682788"`);
        await queryRunner.query(`DROP TABLE "employees"`);
        await queryRunner.query(`DROP TYPE "public"."employees_clearance_level_enum"`);
        await queryRunner.query(`DROP TYPE "public"."employees_employment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."employees_employment_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."employees_gender_enum"`);
    }

}
