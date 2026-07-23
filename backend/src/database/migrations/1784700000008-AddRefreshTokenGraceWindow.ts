import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokenGraceWindow1784700000008 implements MigrationInterface {
    name = 'AddRefreshTokenGraceWindow1784700000008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // See _bmad-output/planning-artifacts/plan-auth-cross-tab-session-sync.md,
        // Fix A -- grace-window reuse for a just-rotated refresh token, so two
        // near-simultaneous callers presenting the same old token (two open
        // tabs, or the proactive middleware refresh landing close to a
        // reactive one) both get the identical new pair instead of one of
        // them hard-401ing on a live session.
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "grace_token" character varying`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "grace_expires_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "grace_expires_at"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "grace_token"`);
    }

}
