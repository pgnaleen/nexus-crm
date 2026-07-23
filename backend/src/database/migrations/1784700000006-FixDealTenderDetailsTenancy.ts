import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDealTenderDetailsTenancy1784700000006 implements MigrationInterface {
    name = 'FixDealTenderDetailsTenancy1784700000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // deal_tender_details shipped as a bare AuditedEntity (no tenant_id at
        // all) with no controller/service ever built on top of it, so it's
        // guaranteed empty -- safe to add tenant_id NOT NULL directly, no
        // backfill needed. Bringing it in line with every other table.
        await queryRunner.query(`ALTER TABLE "deal_tender_details" ADD "tenant_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "deal_tender_details" ADD CONSTRAINT "FK_deal_tender_details_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // submission_deadline is redundant with deals.expected_close_date and
        // was never populated by anything -- dropped rather than shipped unused.
        await queryRunner.query(`ALTER TABLE "deal_tender_details" DROP COLUMN "submission_deadline"`);

        // One tender-details row per deal.
        await queryRunner.query(`ALTER TABLE "deal_tender_details" ADD CONSTRAINT "UQ_deal_tender_details_deal_id" UNIQUE ("deal_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_tender_details" DROP CONSTRAINT "UQ_deal_tender_details_deal_id"`);
        await queryRunner.query(`ALTER TABLE "deal_tender_details" ADD "submission_deadline" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "deal_tender_details" DROP CONSTRAINT "FK_deal_tender_details_tenant"`);
        await queryRunner.query(`ALTER TABLE "deal_tender_details" DROP COLUMN "tenant_id"`);
    }

}
