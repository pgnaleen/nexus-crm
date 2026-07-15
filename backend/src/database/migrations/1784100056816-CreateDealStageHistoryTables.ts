import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDealStageHistoryTables1784100056816 implements MigrationInterface {
    name = 'CreateDealStageHistoryTables1784100056816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "deal_sub_stage_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deal_id" uuid NOT NULL, "from_stage_id" uuid, "to_stage_id" uuid NOT NULL, "moved_by" uuid, "moved_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "note" text, CONSTRAINT "PK_ba54acc723ac6b786a7fb96798e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "deal_main_stage_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deal_id" uuid NOT NULL, "from_stage_id" uuid, "to_stage_id" uuid NOT NULL, "moved_by" uuid, "moved_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "note" text, CONSTRAINT "PK_4f878408755a9f479a91d44f822" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" ADD CONSTRAINT "FK_93fb6d19231962ac3df773d6f79" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" ADD CONSTRAINT "FK_bf356b8695ad3596b04cbe22843" FOREIGN KEY ("from_stage_id") REFERENCES "sub_stages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" ADD CONSTRAINT "FK_47b4b00c7d683ea61965f476ed2" FOREIGN KEY ("to_stage_id") REFERENCES "sub_stages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" ADD CONSTRAINT "FK_7d6e365e3a7dfd06ff388750d6a" FOREIGN KEY ("moved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" ADD CONSTRAINT "FK_f82262d0ed9fb809fa464771f57" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" ADD CONSTRAINT "FK_c6d72df2a5ee8d4956e4fe101f0" FOREIGN KEY ("from_stage_id") REFERENCES "main_stages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" ADD CONSTRAINT "FK_e046e3e29bb2f1b8eaa6c132974" FOREIGN KEY ("to_stage_id") REFERENCES "main_stages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" ADD CONSTRAINT "FK_9cbdcc8b0207d100db82172c14b" FOREIGN KEY ("moved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" DROP CONSTRAINT "FK_9cbdcc8b0207d100db82172c14b"`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" DROP CONSTRAINT "FK_e046e3e29bb2f1b8eaa6c132974"`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" DROP CONSTRAINT "FK_c6d72df2a5ee8d4956e4fe101f0"`);
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" DROP CONSTRAINT "FK_f82262d0ed9fb809fa464771f57"`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" DROP CONSTRAINT "FK_7d6e365e3a7dfd06ff388750d6a"`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" DROP CONSTRAINT "FK_47b4b00c7d683ea61965f476ed2"`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" DROP CONSTRAINT "FK_bf356b8695ad3596b04cbe22843"`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" DROP CONSTRAINT "FK_93fb6d19231962ac3df773d6f79"`);
        await queryRunner.query(`DROP TABLE "deal_main_stage_history"`);
        await queryRunner.query(`DROP TABLE "deal_sub_stage_history"`);
    }

}
