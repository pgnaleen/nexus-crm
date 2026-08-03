import { MigrationInterface, QueryRunner } from "typeorm";

// Nullable like `title` -- only DealDocument rows use it, the other four
// owner types sharing this table (company logo, employee photo/CV,
// certification evidence) leave it null.
export class AddVersionToDocuments1784700000037 implements MigrationInterface {
  name = "AddVersionToDocuments1784700000037";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" ADD "version" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "version"`);
  }
}
