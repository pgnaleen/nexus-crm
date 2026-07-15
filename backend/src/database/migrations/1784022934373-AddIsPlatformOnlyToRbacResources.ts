import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsPlatformOnlyToRbacResources1784022934373 implements MigrationInterface {
    name = 'AddIsPlatformOnlyToRbacResources1784022934373'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rbac_resources" ADD "is_platform_only" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rbac_resources" DROP COLUMN "is_platform_only"`);
    }

}
