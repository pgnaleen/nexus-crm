import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateContacts1784097634353 implements MigrationInterface {
    name = 'CreateContacts1784097634353'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."contacts_role_buying_enum" AS ENUM('economic_buyer', 'champion', 'influencer', 'gatekeeper', 'end_user', 'blocker')`);
        await queryRunner.query(`CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "full_name" character varying NOT NULL, "title" character varying, "department" character varying, "role_buying" "public"."contacts_role_buying_enum", "email" character varying, "mobile_no" character varying, "direct_phone_no" character varying, "linked_in" character varying, "preferred_channels" jsonb, "languages" jsonb, "country" character varying, "timezone" character varying, "relationship_owner" character varying, "photo_url" character varying, "dob" date, "user_id" uuid, "company_id" uuid, CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_71ec7d68cfafa5f3d93c959b807" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_af0a71ac1879b584f255c49c99a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_b53945f3dfe982678bfeb5e1b4f" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_b53945f3dfe982678bfeb5e1b4f"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_af0a71ac1879b584f255c49c99a"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_71ec7d68cfafa5f3d93c959b807"`);
        await queryRunner.query(`DROP TABLE "contacts"`);
        await queryRunner.query(`DROP TYPE "public"."contacts_role_buying_enum"`);
    }

}
