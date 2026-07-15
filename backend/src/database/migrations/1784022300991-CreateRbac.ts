import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRbac1784022300991 implements MigrationInterface {
    name = 'CreateRbac1784022300991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rbac_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" text, CONSTRAINT "PK_b5f28376a8596e5361fbb5734e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6b0632abe346f6f40b3d96659b" ON "rbac_roles" ("tenant_id", "name") `);
        await queryRunner.query(`CREATE TYPE "public"."rbac_resources_risk_level_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TABLE "rbac_resources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "risk_level" "public"."rbac_resources_risk_level_enum" NOT NULL DEFAULT 'low', CONSTRAINT "UQ_4f6f768e7e5e07c1da1c2c4b952" UNIQUE ("name"), CONSTRAINT "PK_a9d9956496119c9ce5c73a4ce55" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rbac_role_user_map" ("role_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_1240f7e9042b789ddc7295cf368" PRIMARY KEY ("role_id", "user_id"))`);
        await queryRunner.query(`CREATE TABLE "rbac_role_resource_map" ("role_id" uuid NOT NULL, "resource_id" uuid NOT NULL, CONSTRAINT "PK_e18aeff3da660294c14ac57f471" PRIMARY KEY ("role_id", "resource_id"))`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD CONSTRAINT "FK_252a038d62e9d956b067421766c" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" ADD CONSTRAINT "FK_72144036a027600e2b8bdde7833" FOREIGN KEY ("role_id") REFERENCES "rbac_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" ADD CONSTRAINT "FK_10a10845ae90c0c1ce5e6090b16" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" ADD CONSTRAINT "FK_0f792a0712f8d48d8aaa61db02f" FOREIGN KEY ("role_id") REFERENCES "rbac_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" ADD CONSTRAINT "FK_53f5cbbd90b314944fd862ac4a4" FOREIGN KEY ("resource_id") REFERENCES "rbac_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" DROP CONSTRAINT "FK_53f5cbbd90b314944fd862ac4a4"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" DROP CONSTRAINT "FK_0f792a0712f8d48d8aaa61db02f"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" DROP CONSTRAINT "FK_10a10845ae90c0c1ce5e6090b16"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" DROP CONSTRAINT "FK_72144036a027600e2b8bdde7833"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP CONSTRAINT "FK_252a038d62e9d956b067421766c"`);
        await queryRunner.query(`DROP TABLE "rbac_role_resource_map"`);
        await queryRunner.query(`DROP TABLE "rbac_role_user_map"`);
        await queryRunner.query(`DROP TABLE "rbac_resources"`);
        await queryRunner.query(`DROP TYPE "public"."rbac_resources_risk_level_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b0632abe346f6f40b3d96659b"`);
        await queryRunner.query(`DROP TABLE "rbac_roles"`);
    }

}
