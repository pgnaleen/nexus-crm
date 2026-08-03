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
}
