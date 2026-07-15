import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDealDocumentsAndContactsMap1784100465465 implements MigrationInterface {
    name = 'CreateDealDocumentsAndContactsMap1784100465465'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deal_documents_doc_type_enum" AS ENUM('contract', 'proposal', 'invoice', 'nda', 'other')`);
        await queryRunner.query(`CREATE TABLE "deal_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "deal_id" uuid NOT NULL, "doc_type" "public"."deal_documents_doc_type_enum" NOT NULL, "title" character varying NOT NULL, "s3_key" character varying NOT NULL, CONSTRAINT "PK_cb6e773dbcf3dedf76803991508" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "deal_contacts_map" ("deal_id" uuid NOT NULL, "contact_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, CONSTRAINT "PK_5c8891e89e5f874f354dffc5834" PRIMARY KEY ("deal_id", "contact_id"))`);
        await queryRunner.query(`ALTER TABLE "deal_documents" ADD CONSTRAINT "FK_0628e743f690f50e1fda36e6f2b" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" ADD CONSTRAINT "FK_f53a6dfc1ccdb4e12af8a0ef5a2" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" ADD CONSTRAINT "FK_e9e41c17db192f1343a1e2555e4" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" ADD CONSTRAINT "FK_5c08df205d3a0d08f2a707de46a" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" DROP CONSTRAINT "FK_5c08df205d3a0d08f2a707de46a"`);
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" DROP CONSTRAINT "FK_e9e41c17db192f1343a1e2555e4"`);
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" DROP CONSTRAINT "FK_f53a6dfc1ccdb4e12af8a0ef5a2"`);
        await queryRunner.query(`ALTER TABLE "deal_documents" DROP CONSTRAINT "FK_0628e743f690f50e1fda36e6f2b"`);
        await queryRunner.query(`DROP TABLE "deal_contacts_map"`);
        await queryRunner.query(`DROP TABLE "deal_documents"`);
        await queryRunner.query(`DROP TYPE "public"."deal_documents_doc_type_enum"`);
    }

}
