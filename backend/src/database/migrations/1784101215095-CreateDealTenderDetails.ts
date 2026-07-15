import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDealTenderDetails1784101215095 implements MigrationInterface {
    name = 'CreateDealTenderDetails1784101215095'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deal_tender_details_submission_mode_enum" AS ENUM('online', 'physical', 'hybrid')`);
        await queryRunner.query(`CREATE TYPE "public"."deal_tender_details_evaluation_type_enum" AS ENUM('technical', 'financial', 'technical_and_financial')`);
        await queryRunner.query(`CREATE TABLE "deal_tender_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "deal_id" uuid NOT NULL, "tender_reference" character varying NOT NULL, "issuing_body" character varying NOT NULL, "submission_deadline" TIMESTAMP WITH TIME ZONE, "bid_bond_required" boolean NOT NULL DEFAULT false, "bid_bond_amount" numeric(14,2), "emd_amount" numeric(14,2), "submission_mode" "public"."deal_tender_details_submission_mode_enum", "evaluation_type" "public"."deal_tender_details_evaluation_type_enum", CONSTRAINT "PK_85d893cea67e88eb23a4c82f1c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "deal_tender_details" ADD CONSTRAINT "FK_4014907224e94d205ed4ccee067" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_tender_details" DROP CONSTRAINT "FK_4014907224e94d205ed4ccee067"`);
        await queryRunner.query(`DROP TABLE "deal_tender_details"`);
        await queryRunner.query(`DROP TYPE "public"."deal_tender_details_evaluation_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."deal_tender_details_submission_mode_enum"`);
    }

}
