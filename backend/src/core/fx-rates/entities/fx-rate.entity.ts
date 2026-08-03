import { Column, Entity, Index } from "typeorm";
import { AuditedEntity } from "../../audited.entity";

// Platform-level (no tenant_id) -- market exchange rates aren't tenant data.
// One row per ISO 4217 currency code, refreshed daily by FxRatesService's
// cron job. unitsPerUsd matches exchangerate-api.com's own /latest/USD
// response shape (how many units of this currency equal 1 USD) so writes
// need no reshaping -- USD itself gets a row too (unitsPerUsd = 1) so it
// isn't a special case anywhere that reads this table.
@Entity("fx_rates")
@Index(["currencyCode"], { unique: true })
export class FxRate extends AuditedEntity {
  @Column({ name: "currency_code", type: "varchar", length: 3 })
  currencyCode!: string;

  @Column({ name: "units_per_usd", type: "numeric", precision: 18, scale: 6 })
  unitsPerUsd!: number;

  @Column({ name: "fetched_at", type: "timestamptz" })
  fetchedAt!: Date;
}
