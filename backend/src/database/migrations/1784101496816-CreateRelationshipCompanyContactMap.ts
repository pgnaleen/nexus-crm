import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRelationshipCompanyContactMap1784101496816 implements MigrationInterface {
    name = 'CreateRelationshipCompanyContactMap1784101496816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "relationship_company_contact_map" ("relationship_type_id" uuid NOT NULL, "company_id" uuid NOT NULL, "contact_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, CONSTRAINT "PK_880ecb409e38b3caa133b9697ed" PRIMARY KEY ("relationship_type_id", "company_id", "contact_id"))`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_d9e5321cae2f6882b397a28b91f" FOREIGN KEY ("relationship_type_id") REFERENCES "relationship_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_f0cac28d95ea4850cd2ae6b39d3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_03e06dd0fa1e1ef0810f5dcf3ea" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_c7e98b5d36ea2cca752053d51c7" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_c7e98b5d36ea2cca752053d51c7"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_03e06dd0fa1e1ef0810f5dcf3ea"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_f0cac28d95ea4850cd2ae6b39d3"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_d9e5321cae2f6882b397a28b91f"`);
        await queryRunner.query(`DROP TABLE "relationship_company_contact_map"`);
    }

}
