import { MigrationInterface, QueryRunner } from "typeorm";

export class RepairRelationshipCompanyContactMap1784227424114 implements MigrationInterface {
    name = 'RepairRelationshipCompanyContactMap1784227424114'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_c7e98b5d36ea2cca752053d51c7"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "PK_880ecb409e38b3caa133b9697ed"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "PK_bd4a46326dd589d0e7b3617deb7" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD "tenant_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD "is_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_d9e5321cae2f6882b397a28b91f"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_f0cac28d95ea4850cd2ae6b39d3"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_03e06dd0fa1e1ef0810f5dcf3ea"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ALTER COLUMN "company_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ALTER COLUMN "contact_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "CHK_95552f561aac87fae483970812" CHECK (("company_id" IS NOT NULL AND "contact_id" IS NULL) OR ("company_id" IS NULL AND "contact_id" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_6af1a2c634887df48f7fef97054" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_d9e5321cae2f6882b397a28b91f" FOREIGN KEY ("relationship_type_id") REFERENCES "relationship_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_f0cac28d95ea4850cd2ae6b39d3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_03e06dd0fa1e1ef0810f5dcf3ea" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_relationship_company_contact_map_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_relationship_company_contact_map_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_relationship_company_contact_map_updated_by"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_relationship_company_contact_map_created_by"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_03e06dd0fa1e1ef0810f5dcf3ea"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_f0cac28d95ea4850cd2ae6b39d3"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_d9e5321cae2f6882b397a28b91f"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "FK_6af1a2c634887df48f7fef97054"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "CHK_95552f561aac87fae483970812"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ALTER COLUMN "contact_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ALTER COLUMN "company_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_03e06dd0fa1e1ef0810f5dcf3ea" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_f0cac28d95ea4850cd2ae6b39d3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_d9e5321cae2f6882b397a28b91f" FOREIGN KEY ("relationship_type_id") REFERENCES "relationship_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP COLUMN "is_active"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP COLUMN "tenant_id"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP CONSTRAINT "PK_bd4a46326dd589d0e7b3617deb7"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "PK_880ecb409e38b3caa133b9697ed" PRIMARY KEY ("relationship_type_id", "company_id", "contact_id")`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "relationship_company_contact_map" ADD CONSTRAINT "FK_c7e98b5d36ea2cca752053d51c7" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
