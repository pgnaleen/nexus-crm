import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTeams1784093911925 implements MigrationInterface {
    name = 'CreateTeams1784093911925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_109638590074998bb72a2f2cf08"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP CONSTRAINT "FK_252a038d62e9d956b067421766c"`);
        await queryRunner.query(`CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "name" character varying NOT NULL, CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD CONSTRAINT "FK_252a038d62e9d956b067421766c" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_11c78d7c145fb2c24ae04b17c0c" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_e9998d2ac53a30bf287cb328b26" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_f9983add46ea015788ddad8f271" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_f9983add46ea015788ddad8f271"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_e9998d2ac53a30bf287cb328b26"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_11c78d7c145fb2c24ae04b17c0c"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP CONSTRAINT "FK_252a038d62e9d956b067421766c"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_109638590074998bb72a2f2cf08"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD CONSTRAINT "FK_252a038d62e9d956b067421766c" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
