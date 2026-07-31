# Block deleting Deal Sources / Departments / Employees while Deals depend on them

## Context

Investigated whether deleting a resource a Deal points at (Deal Source, Department, Main/Sub
Stage, Company/Contact, Employee) is blocked while deals still reference it. Only Main/Sub Stage
actually is — `sub-stages.service.ts`/`main-stages.service.ts` both count active deals and throw a
`ConflictException` naming the count, before soft-deleting. Deal Source, Department, and Employee
have no such check at all, and it's worse than a missing nicety: all three deletes are *soft*
deletes, so even the DB-level `ON DELETE SET NULL` foreign keys these tables already have never
actually fire (that only triggers on a real `DELETE`). A deal is left silently pointing at a
now-hidden, soft-deleted row — nobody is told, nothing renders wrong until someone specifically
looks. This plan copies the Main/Sub Stage pattern onto the other three. (Company/Contact is
explicitly out of scope — there's no delete endpoint for a Company at all today, so there's
nothing to guard yet; flagged separately, not built here.)

## Design

Same shape for all three files, mirroring `sub-stages.service.ts`'s `countActiveDeals`/`remove()`
exactly:

1. Add imports: `InjectDataSource` (`@nestjs/typeorm`), `DataSource` (`typeorm`), `Deal`
   (`../deals/entities/deal.entity`), `ConflictException` (`@nestjs/common`, already present in
   `employees.service.ts`, missing in the other two).
2. Add `@InjectDataSource() private readonly dataSource: DataSource` to the constructor. No
   module wiring needed — confirmed via `main-stages.module.ts` precedent that `Deal` doesn't need
   to be in `deal-sources.module.ts`/`departments.module.ts`/`employees.module.ts`'s own
   `TypeOrmModule.forFeature([...])` list; `dataSource.getRepository(Deal)` resolves off the
   global connection metadata regardless of which module injected it.
3. Add a count check, called **before** the existing `try` block (so the `ConflictException` is a
   business-rule rejection, not logged as an error — same as the stage services' comment explains).

### `backend/src/modules/deal-sources/deal-sources.service.ts`
```ts
async countActiveDeals(sourceId: string): Promise<number> {
  return this.dataSource.getRepository(Deal).count({ where: { sourceId } });
}
```
In `remove()`, after `findOneOrFail(id)`, before the `try`:
```ts
const activeDealCount = await this.countActiveDeals(id);
if (activeDealCount > 0) {
  throw new ConflictException(
    `Cannot delete this deal source: ${activeDealCount} deal(s) are currently using it. Reassign them to a different source first.`,
  );
}
```

### `backend/src/modules/departments/departments.service.ts`
Same shape, `where: { departmentId: id }`, message:
`` `Cannot delete this department: ${activeDealCount} deal(s) are currently assigned to it. Reassign them to a different department first.` ``

### `backend/src/modules/employees/employees.service.ts`
Three FKs point at Employee (`ownerId` required/no-onDelete, `preSalesPersonId`/`pmoId` nullable
`SET NULL` — but that `SET NULL` never fires under soft-delete either, same gotcha, so all three
need the same app-level guard, not just `ownerId`). Also: `findOneBareOrFail` currently sits
*inside* `remove()`'s `try` block, unlike the other services — move it (and the new count check)
before the `try`, matching the established ordering rule.

```ts
const [ownerCount, preSalesCount, pmoCount] = await Promise.all([
  this.dataSource.getRepository(Deal).count({ where: { ownerId: id } }),
  this.dataSource.getRepository(Deal).count({ where: { preSalesPersonId: id } }),
  this.dataSource.getRepository(Deal).count({ where: { pmoId: id } }),
]);
const parts: string[] = [];
if (ownerCount > 0) parts.push(`${ownerCount} deal(s) as owner`);
if (preSalesCount > 0) parts.push(`${preSalesCount} deal(s) as pre-sales`);
if (pmoCount > 0) parts.push(`${pmoCount} deal(s) as PMO`);
if (parts.length > 0) {
  throw new ConflictException(
    `Cannot delete this employee: currently assigned to ${parts.join(", ")}. Reassign these deals first.`,
  );
}
```

## Verification
1. Backend typecheck clean, zero new errors beyond the pre-existing baseline.
2. For each of the three: create a real deal referencing a Deal Source / Department / Employee
   (as owner, then separately as pre-sales, then as PMO), attempt to delete that resource via its
   real API endpoint, confirm a `409 Conflict` with the exact dependent-count message — not a
   silent success.
3. Reassign/remove the deal's reference, confirm the same delete now succeeds normally.
4. Confirm deleting a Deal Source/Department/Employee with **zero** dependent deals still works
   exactly as before (no regression for the common case).
