import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDealSources1784099048720 implements MigrationInterface {
    name = 'CreateDealSources1784099048720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "deal_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "category" character varying, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_5f5ca071facb450a7393dd5de14" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "deal_sources" ADD CONSTRAINT "FK_bf85380b5cba943f05d10c6b55a" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_sources" DROP CONSTRAINT "FK_bf85380b5cba943f05d10c6b55a"`);
        await queryRunner.query(`DROP TABLE "deal_sources"`);
    }

}
