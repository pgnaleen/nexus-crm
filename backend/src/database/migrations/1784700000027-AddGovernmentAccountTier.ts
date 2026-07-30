import { MigrationInterface, QueryRunner } from "typeorm";

// Adds "government" as a selectable Company Account Tier.
export class AddGovernmentAccountTier1784700000027 implements MigrationInterface {
  name = "AddGovernmentAccountTier1784700000027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."companies_account_tier_enum" ADD VALUE IF NOT EXISTS 'government'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres cannot drop a single enum value; leaving it in place is
    // harmless once no rows reference it.
  }
}
