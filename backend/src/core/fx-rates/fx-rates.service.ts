import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { CronJob } from "cron";
import { Repository } from "typeorm";
import { FxRate } from "./entities/fx-rate.entity";

const DAILY_JOB_NAME = "daily-fx-rate-refresh";

export interface FxConvertResult {
  value: number;
  warning?: string;
}

// Single boundary for currency conversion in the app (mirrors S3Service/
// MailService's role for their own external integrations) -- registered as
// a plain provider in CoreModule, same as those two, rather than its own
// feature module (no controller of its own). Feeds the Sales Pipeline
// Dashboard's cross-currency KPIs. In-memory cache loaded from the DB at
// boot (not the live API on every restart); refreshed once daily via cron,
// same SchedulerRegistry/CronJob pattern DbBackupService already uses. An
// outage never crashes anything: fetchAndStoreRates() swallows its own
// errors and the last-cached rates (if any) keep serving.
@Injectable()
export class FxRatesService implements OnModuleInit {
  private readonly logger = new Logger(FxRatesService.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private ratesByCode = new Map<string, number>();
  private ratesAsOf: Date | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FxRate)
    private readonly fxRatesRepo: Repository<FxRate>,
    private readonly scheduler: SchedulerRegistry,
  ) {
    this.apiKey = this.config.get<string>("FX_RATE_API_KEY");
    this.baseUrl =
      this.config.get<string>("FX_RATE_API_BASE_URL") ?? "https://v6.exchangerate-api.com/v6";
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async onModuleInit(): Promise<void> {
    await this.loadCacheFromDb();

    if (!this.isEnabled()) {
      this.logger.warn(
        "FX rate provider disabled (FX_RATE_API_KEY unset) -- serving whatever rates are already cached, if any; nothing will refresh",
      );
      return;
    }

    // Fixed daily hour (not config-driven like NIGHTLY_BACKUP_HOUR) --
    // unlike a DB backup, this has no real "off-peak" requirement, so one
    // fewer env var to configure. 3am local, an hour after the backup job,
    // to keep the two off each other's toes.
    const job = new CronJob("0 0 3 * * *", () => {
      this.fetchAndStoreRates().catch((e) =>
        this.logger.error(`Daily FX rate refresh failed: ${(e as Error).message}`),
      );
    });
    this.scheduler.addCronJob(DAILY_JOB_NAME, job);
    job.start();
    this.logger.log("Daily FX rate refresh scheduled for 03:00 local time");

    // If the table's empty (fresh install, first boot ever), don't wait
    // until 3am for the dashboard to have any rates at all.
    if (this.ratesByCode.size === 0) {
      this.logger.log("No cached FX rates found -- fetching once at boot");
      await this.fetchAndStoreRates();
    }
  }

  // Never throws -- called from onModuleInit, so an unhandled rejection here
  // would crash the entire app's boot over a currency-conversion table
  // being unreachable (e.g. the migration hasn't run yet, or a transient DB
  // blip), which is exactly the "must not be a hard dependency" failure
  // mode this whole service exists to avoid. Falls back to an empty cache
  // on failure -- every consumer (getRate/convert) already treats "no rate
  // known" as a non-fatal, reportable condition, not an error.
  private async loadCacheFromDb(): Promise<void> {
    try {
      const rows = await this.fxRatesRepo.find();
      this.ratesByCode = new Map(rows.map((row) => [row.currencyCode, Number(row.unitsPerUsd)]));
      this.ratesAsOf = rows.reduce<Date | null>((latest, row) => {
        return !latest || row.fetchedAt > latest ? row.fetchedAt : latest;
      }, null);
      this.logger.debug(`loadCacheFromDb loaded ${rows.length} rate(s), asOf=${this.ratesAsOf?.toISOString() ?? "never"}`);
    } catch (err) {
      this.logger.error(`loadCacheFromDb failed: ${(err as Error).message}`, (err as Error).stack);
      this.ratesByCode = new Map();
      this.ratesAsOf = null;
    }
  }

  async fetchAndStoreRates(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn("fetchAndStoreRates skipped -- FX_RATE_API_KEY unset");
      return;
    }
    this.logger.debug("fetchAndStoreRates called");
    try {
      const response = await fetch(`${this.baseUrl}/${this.apiKey}/latest/USD`);
      if (!response.ok) {
        throw new Error(`FX provider returned HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        result: string;
        conversion_rates?: Record<string, number>;
        "error-type"?: string;
      };
      if (body.result !== "success" || !body.conversion_rates) {
        throw new Error(`FX provider returned an error result: ${body["error-type"] ?? "unknown"}`);
      }

      const fetchedAt = new Date();
      const entries = Object.entries(body.conversion_rates);
      this.logger.debug(`fetchAndStoreRates received ${entries.length} currency rate(s)`);

      for (const [currencyCode, unitsPerUsd] of entries) {
        await this.fxRatesRepo
          .createQueryBuilder()
          .insert()
          .into(FxRate)
          .values({ currencyCode, unitsPerUsd, fetchedAt })
          .orUpdate(["units_per_usd", "fetched_at"], ["currency_code"])
          .execute();
      }

      await this.loadCacheFromDb();
      this.logger.log(`fetchAndStoreRates succeeded, ${entries.length} rate(s) refreshed`);
    } catch (err) {
      // Never rethrow -- an outage must not crash the cron job or boot.
      // The in-memory cache (if any) keeps serving whatever it already has.
      this.logger.error(`fetchAndStoreRates failed: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  /** In-memory only, synchronous -- how many units of `code` equal 1 USD, or null if unknown. */
  getRate(code: string): number | null {
    return this.ratesByCode.get(code) ?? null;
  }

  /** Timestamp of the currently-cached rate set, or null if nothing has ever been fetched/loaded. */
  getRatesAsOf(): Date | null {
    return this.ratesAsOf;
  }

  /**
   * Converts `amount` from currency `from` to currency `to`. Never throws --
   * if either currency has no known rate, returns the original amount
   * unconverted plus a `warning` string, so a caller can surface that to the
   * user instead of silently mis-reporting a total.
   */
  convert(amount: number, from: string, to: string): FxConvertResult {
    if (from === to) return { value: amount };
    const fromRate = this.getRate(from);
    const toRate = this.getRate(to);
    if (fromRate == null || toRate == null) {
      const missing = fromRate == null ? from : to;
      return { value: amount, warning: `No exchange rate available for ${missing}` };
    }
    return { value: (amount / fromRate) * toRate };
  }
}
