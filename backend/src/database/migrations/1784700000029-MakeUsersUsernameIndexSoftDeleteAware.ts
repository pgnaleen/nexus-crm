import { MigrationInterface, QueryRunner } from "typeorm";

// The original username uniqueness index ignored soft-deletes: UsersService's
// availability check correctly excludes a soft-deleted user (TypeORM
// auto-filters deletedAt IS NULL on every find()), so it reports a username
// as free -- but the plain UNIQUE(tenant_id, username) index doesn't know
// about deletedAt at all and still rejects the insert, surfacing as a raw
// 500 instead of the intended 409. Scoping the index to active rows only
// (a partial index) makes both agree: a username becomes reusable once the
// account that held it is soft-deleted, matching how every other
// "is this taken" check in this codebase already treats soft-deleted rows
// as gone.
export class MakeUsersUsernameIndexSoftDeleteAware1784700000029 implements MigrationInterface {
  name = "MakeUsersUsernameIndexSoftDeleteAware1784700000029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_52a29f8fc340e73d124af517f2"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_52a29f8fc340e73d124af517f2" ON "users" ("tenant_id", "username")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_52a29f8fc340e73d124af517f2"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_52a29f8fc340e73d124af517f2" ON "users" ("tenant_id", "username")`);
  }
}
