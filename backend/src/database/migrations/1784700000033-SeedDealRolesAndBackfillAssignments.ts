import { MigrationInterface, QueryRunner } from "typeorm";

// Data-only migration, no schema change. Seeds the 3 default deal_roles
// (Sales Person/Pre-Sales/PMO) for every tenant that already exists (new
// tenants get the same 3 rows going forward from TenantsService.create()),
// then backfills deal_role_assignments from each deal's current
// owner_id/pre_sales_person_id/pmo_id so existing deals show up correctly
// in the new Team UI without a data gap.
//
// Real gotcha, handled explicitly rather than silently dropped: backfilling
// requires employees.user_id to be set for the assigned Employee (deal_role_
// assignments is keyed on user, not employee -- see the entity's own
// comment). Any deal whose owner/pre-sales/pmo Employee has no linked User
// account cannot be backfilled -- there's no User row to point at. Those
// cases are reported via RAISE NOTICE (visible in the migration run output/
// backend logs) rather than failing the migration or silently losing the
// assignment. deals.owner_id etc. are NOT dropped by this migration -- that
// happens in a later migration, only after this backfill has been reviewed.
export class SeedDealRolesAndBackfillAssignments1784700000033 implements MigrationInterface {
  name = "SeedDealRolesAndBackfillAssignments1784700000033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "deal_roles" ("tenant_id", "name", "requires_primary_on_create")
      SELECT "id", 'Sales Person', true FROM "tenants_registry"
    `);
    await queryRunner.query(`
      INSERT INTO "deal_roles" ("tenant_id", "name", "requires_primary_on_create")
      SELECT "id", 'Pre-Sales', false FROM "tenants_registry"
    `);
    await queryRunner.query(`
      INSERT INTO "deal_roles" ("tenant_id", "name", "requires_primary_on_create")
      SELECT "id", 'PMO', false FROM "tenants_registry"
    `);

    await queryRunner.query(`
      INSERT INTO "deal_role_assignments" ("deal_id", "role_id", "user_id", "is_primary", "created_by")
      SELECT d."id", dr."id", e."user_id", true, d."created_by"
      FROM "deals" d
      JOIN "employees" e ON e."id" = d."owner_id"
      JOIN "deal_roles" dr ON dr."tenant_id" = d."tenant_id" AND dr."name" = 'Sales Person'
      WHERE e."user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "deal_role_assignments" ("deal_id", "role_id", "user_id", "is_primary", "created_by")
      SELECT d."id", dr."id", e."user_id", false, d."created_by"
      FROM "deals" d
      JOIN "employees" e ON e."id" = d."pre_sales_person_id"
      JOIN "deal_roles" dr ON dr."tenant_id" = d."tenant_id" AND dr."name" = 'Pre-Sales'
      WHERE d."pre_sales_person_id" IS NOT NULL AND e."user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "deal_role_assignments" ("deal_id", "role_id", "user_id", "is_primary", "created_by")
      SELECT d."id", dr."id", e."user_id", false, d."created_by"
      FROM "deals" d
      JOIN "employees" e ON e."id" = d."pmo_id"
      JOIN "deal_roles" dr ON dr."tenant_id" = d."tenant_id" AND dr."name" = 'PMO'
      WHERE d."pmo_id" IS NOT NULL AND e."user_id" IS NOT NULL
    `);

    // Report (do not fail) every deal that couldn't be backfilled because its
    // assigned Employee has no linked User account.
    const unbackfillable: Array<{ deal_code: string; deal_name: string; field: string; employee_name: string }> =
      await queryRunner.query(`
        SELECT d."deal_code", d."name" AS deal_name, 'owner_id' AS field, e."full_name" AS employee_name
        FROM "deals" d JOIN "employees" e ON e."id" = d."owner_id"
        WHERE e."user_id" IS NULL
        UNION ALL
        SELECT d."deal_code", d."name" AS deal_name, 'pre_sales_person_id' AS field, e."full_name" AS employee_name
        FROM "deals" d JOIN "employees" e ON e."id" = d."pre_sales_person_id"
        WHERE d."pre_sales_person_id" IS NOT NULL AND e."user_id" IS NULL
        UNION ALL
        SELECT d."deal_code", d."name" AS deal_name, 'pmo_id' AS field, e."full_name" AS employee_name
        FROM "deals" d JOIN "employees" e ON e."id" = d."pmo_id"
        WHERE d."pmo_id" IS NOT NULL AND e."user_id" IS NULL
      `);
    if (unbackfillable.length > 0) {
      console.warn(
        `[SeedDealRolesAndBackfillAssignments] ${unbackfillable.length} deal field(s) could not be backfilled ` +
          `into deal_role_assignments -- the assigned Employee has no linked User account. Link a User to these ` +
          `Employees (or manually re-assign these deals in the new Team UI) before dropping the legacy columns:`,
      );
      for (const row of unbackfillable) {
        console.warn(`  - deal ${row.deal_code} ("${row.deal_name}"), field ${row.field}: employee "${row.employee_name}"`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "deal_role_assignments"
      WHERE "role_id" IN (SELECT "id" FROM "deal_roles" WHERE "name" IN ('Sales Person', 'Pre-Sales', 'PMO'))
    `);
    await queryRunner.query(`DELETE FROM "deal_roles" WHERE "name" IN ('Sales Person', 'Pre-Sales', 'PMO')`);
  }
}
