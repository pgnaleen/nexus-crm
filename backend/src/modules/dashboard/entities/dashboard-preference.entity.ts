import { Column, Entity, Index } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import type { DashboardLayoutItem } from "@orelia/common";

// One row per (tenant, user) -- upserted in place, never append-only. userId
// is the row's owner and is distinct from createdBy/updatedBy (which the
// base class already provides and which, for this table, will always equal
// userId since nobody can write another user's preferences -- see the
// service/controller, both scoped to the caller's own id only).
@Entity("dashboard_preferences")
@Index("UQ_dashboard_preferences_tenant_user", ["tenantId", "userId"], { unique: true })
export class DashboardPreference extends AuditedTenantEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "jsonb" })
  visibleWidgetKeys!: string[];

  @Column({ type: "jsonb" })
  layout!: DashboardLayoutItem[];

  // The dashboard's chosen display currency (ISO 4217, e.g. "LKR") -- every
  // Deal can carry its own currency, so widgets convert on the fly via
  // FxRatesService into whichever one is picked here. Nullable: no row (or a
  // row saved before this column existed) means "no preference saved yet",
  // and the frontend/service both fall back to "USD" in that case.
  @Column({ type: "varchar", length: 3, nullable: true })
  currency?: string | null;
}
