import { MigrationInterface, QueryRunner } from "typeorm";

// Closes a race window found during code review of the Relationship Tags
// feature: linkExistingCompanyToType/linkExistingContactToType do a
// check-then-act (look up an existing row, then insert or reactivate) with
// no transaction and, until now, no DB-level constraint backing it -- two
// concurrent requests tagging the same company/contact into the same
// relationship type could both see "no existing row" and both insert,
// producing two active tags for the same pair. At most one *active*
// relationship_company_contact_map row should ever exist per
// (company, relationship_type) or (contact, relationship_type) pair -- so
// this is a partial unique index, not conditioned on is_active but scoped to
// non-soft-deleted rows only. WHERE "deleted_at" IS NULL is required, not
// optional, per the same reasoning as
// 1784700000029-MakeUsersUsernameIndexSoftDeleteAware.ts: the service layer's
// existing-row lookup (findOneScoped) already auto-filters deletedAt IS NULL,
// so it correctly treats a soft-deleted map row's slot as free -- an index
// without the same filter would disagree, permanently blocking a legitimate
// re-tag of a pair whose old row was soft-deleted (surfacing as a false 409
// instead of the intended insert). Found in a second review pass; omitted
// from the first version of this migration despite the identical fix
// existing right next to it in the same migrations folder.
export class AddRelationshipCompanyContactMapUniqueIndexes1784700000028 implements MigrationInterface {
  name = "AddRelationshipCompanyContactMapUniqueIndexes1784700000028";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_relationship_company_map_company_type"
      ON "relationship_company_contact_map" ("relationship_type_id", "company_id")
      WHERE "company_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_relationship_company_map_contact_type"
      ON "relationship_company_contact_map" ("relationship_type_id", "contact_id")
      WHERE "contact_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_relationship_company_map_contact_type"`);
    await queryRunner.query(`DROP INDEX "UQ_relationship_company_map_company_type"`);
  }
}
