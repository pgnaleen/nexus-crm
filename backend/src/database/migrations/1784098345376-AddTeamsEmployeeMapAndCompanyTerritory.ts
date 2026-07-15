import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamsEmployeeMapAndCompanyTerritory1784098345376 implements MigrationInterface {
    name = 'AddTeamsEmployeeMapAndCompanyTerritory1784098345376'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "teams_employee_map" ("team_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, CONSTRAINT "PK_2001551af324cd3678f8d94bf80" PRIMARY KEY ("team_id", "employee_id"))`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "territory_owner_id" uuid`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "territory_notes" text`);
        await queryRunner.query(`ALTER TABLE "teams_employee_map" ADD CONSTRAINT "FK_1cac2aadb94ae6310c7bf31dbdf" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams_employee_map" ADD CONSTRAINT "FK_43a227e4633ebdb44a6b21852b5" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams_employee_map" ADD CONSTRAINT "FK_7ef84eb49be6f0aa6bc938b5515" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "companies" ADD CONSTRAINT "FK_43278bc185f86f7c98e20c9eebf" FOREIGN KEY ("territory_owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT "FK_43278bc185f86f7c98e20c9eebf"`);
        await queryRunner.query(`ALTER TABLE "teams_employee_map" DROP CONSTRAINT "FK_7ef84eb49be6f0aa6bc938b5515"`);
        await queryRunner.query(`ALTER TABLE "teams_employee_map" DROP CONSTRAINT "FK_43a227e4633ebdb44a6b21852b5"`);
        await queryRunner.query(`ALTER TABLE "teams_employee_map" DROP CONSTRAINT "FK_1cac2aadb94ae6310c7bf31dbdf"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "territory_notes"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "territory_owner_id"`);
        await queryRunner.query(`DROP TABLE "teams_employee_map"`);
    }

}
