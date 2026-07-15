import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRelationshipTypes1784095772060 implements MigrationInterface {
    name = 'CreateRelationshipTypes1784095772060'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "relationship_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "name" character varying NOT NULL, CONSTRAINT "PK_ea5ddbd350c8380485eefee276e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "relationship_types" ADD CONSTRAINT "FK_b6ae8dc153aed61b323a511aeee" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "relationship_types" DROP CONSTRAINT "FK_b6ae8dc153aed61b323a511aeee"`);
        await queryRunner.query(`DROP TABLE "relationship_types"`);
    }

}
