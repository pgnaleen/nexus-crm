import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterEmployeesTitleToEnum1784700000005 implements MigrationInterface {
    name = 'AlterEmployeesTitleToEnum1784700000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // "title" was free-text ("Senior Engineer" style job title) -- product
        // decision: it's actually a salutation field (Mr/Mrs/Ms/Miss/Dr), with
        // job title captured separately by "current_designation". Any existing
        // value that doesn't match the new enum is nulled rather than blocking
        // the migration -- there's no way to guess a salutation from free text.
        await queryRunner.query(`UPDATE "employees" SET "title" = NULL WHERE "title" IS NOT NULL AND lower("title") NOT IN ('mr', 'mrs', 'ms', 'miss', 'dr')`);
        await queryRunner.query(`CREATE TYPE "public"."employees_title_enum" AS ENUM('mr', 'mrs', 'ms', 'miss', 'dr')`);
        await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "title" TYPE "public"."employees_title_enum" USING (lower("title")::"public"."employees_title_enum")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "title" TYPE character varying USING ("title"::text)`);
        await queryRunner.query(`DROP TYPE "public"."employees_title_enum"`);
    }

}
