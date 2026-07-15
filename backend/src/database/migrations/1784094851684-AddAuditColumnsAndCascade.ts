import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditColumnsAndCascade1784094851684 implements MigrationInterface {
    name = 'AddAuditColumnsAndCascade1784094851684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "industries" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "industries" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "industries" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "industries" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "industries" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" ADD "created_by" uuid`);

        // created_by/updated_by -> users(id) FKs, added by hand since AuditedEntity/
        // AuditedTenantEntity intentionally don't declare relation metadata for these
        // (see the comment in core/audited.entity.ts) — still enforced at the DB level.
        await queryRunner.query(`ALTER TABLE "industries" ADD CONSTRAINT "FK_industries_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "industries" ADD CONSTRAINT "FK_industries_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "plans" ADD CONSTRAINT "FK_plans_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "plans" ADD CONSTRAINT "FK_plans_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD CONSTRAINT "FK_tenants_registry_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" ADD CONSTRAINT "FK_tenants_registry_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD CONSTRAINT "FK_rbac_roles_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" ADD CONSTRAINT "FK_rbac_roles_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD CONSTRAINT "FK_rbac_resources_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD CONSTRAINT "FK_rbac_resources_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // users' own createdBy/updatedBy are self-referential (declared directly on
        // User, not via the shared base — see comment in user.entity.ts).
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_f32b1cb14a9920477bcfd63df2c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_b75c92ef36f432fe68ec300a7d4" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" ADD CONSTRAINT "FK_f6183589881c6cfbd5510b3a965" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" ADD CONSTRAINT "FK_a00316196e6b6c2b1317c7ea01e" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" DROP CONSTRAINT "FK_a00316196e6b6c2b1317c7ea01e"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" DROP CONSTRAINT "FK_f6183589881c6cfbd5510b3a965"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_b75c92ef36f432fe68ec300a7d4"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_f32b1cb14a9920477bcfd63df2c"`);

        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP CONSTRAINT "FK_rbac_resources_updated_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP CONSTRAINT "FK_rbac_resources_created_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP CONSTRAINT "FK_rbac_roles_updated_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP CONSTRAINT "FK_rbac_roles_created_by"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP CONSTRAINT "FK_tenants_registry_updated_by"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP CONSTRAINT "FK_tenants_registry_created_by"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP CONSTRAINT "FK_plans_updated_by"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP CONSTRAINT "FK_plans_created_by"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP CONSTRAINT "FK_industries_updated_by"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP CONSTRAINT "FK_industries_created_by"`);

        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_resource_map" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_role_user_map" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "rbac_roles" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "tenants_registry" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "industries" DROP COLUMN "created_at"`);
    }

}
