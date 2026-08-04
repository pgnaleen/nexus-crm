import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  DashboardStatCards,
  DealsMetricsResponse,
  DealStatus,
  PartnersMetricsResponse,
  PriorityTaskFlowEventType,
  SystemRole,
  TasksMetricsResponse,
  TenantsMetricsResponse,
  UsersMetricsResponse,
} from "@orelia/common";
import { FxRatesService } from "../../core/fx-rates/fx-rates.service";
import { TenantContextService } from "../../core/tenant";
import { Deal } from "../deals/entities/deal.entity";
import { DealPartnersMap } from "../deals/entities/deal-partners-map.entity";
import { MainStageHistory } from "../deals/entities/main-stage-history.entity";
import { SubStageHistory } from "../deals/entities/sub-stage-history.entity";
import { PriorityTask } from "../priority-tasks/entities/priority-task.entity";
import { PriorityTaskFlow } from "../priority-tasks/entities/priority-task-flow.entity";
import { RbacRoleUserMap } from "../rbac/entities/rbac-role-user-map.entity";
import { RelationshipTypesService } from "../relationship-types/relationship-types.service";
import { Tenant } from "../tenants/entities/tenant.entity";

// A deal sitting in its current stage longer than this is surfaced on the
// At-Risk Deals widget. Not user-configurable yet -- a fixed, documented
// starting point.
const AT_RISK_THRESHOLD_DAYS = 14;
const AT_RISK_LIMIT = 5;

@Injectable()
export class DashboardMetricsService {
  private readonly logger = new Logger(DashboardMetricsService.name);

  constructor(
    @InjectRepository(Deal) private readonly dealsRepo: Repository<Deal>,
    @InjectRepository(MainStageHistory) private readonly mainStageHistoryRepo: Repository<MainStageHistory>,
    @InjectRepository(SubStageHistory) private readonly subStageHistoryRepo: Repository<SubStageHistory>,
    @InjectRepository(DealPartnersMap) private readonly dealPartnersRepo: Repository<DealPartnersMap>,
    @InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(RbacRoleUserMap) private readonly rbacRoleUserMapRepo: Repository<RbacRoleUserMap>,
    @InjectRepository(PriorityTask) private readonly priorityTasksRepo: Repository<PriorityTask>,
    @InjectRepository(PriorityTaskFlow) private readonly priorityTaskFlowRepo: Repository<PriorityTaskFlow>,
    private readonly fxRatesService: FxRatesService,
    private readonly relationshipTypesService: RelationshipTypesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private convertTo(amount: number, fromCurrency: string, targetCurrency: string): number {
    return this.fxRatesService.convert(amount, fromCurrency, targetCurrency).value;
  }

  async getDealsMetrics(months: number, targetCurrency: string): Promise<DealsMetricsResponse> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`getDealsMetrics called (tenantId=${tenantId}, months=${months}, currency=${targetCurrency})`);
    try {
      const [statCards, revenueForecast, dealsByStage, valueByStage, dealsBySource, dealsByDepartment, atRiskDeals] =
        await Promise.all([
          this.getStatCards(tenantId, months, targetCurrency),
          this.getRevenueForecast(tenantId, months, targetCurrency),
          this.getDealsAndValueByStage(tenantId, "count", targetCurrency),
          this.getDealsAndValueByStage(tenantId, "value", targetCurrency),
          this.getDealsBySource(tenantId, months),
          this.getDealsByDepartment(tenantId),
          this.getAtRiskDeals(tenantId, targetCurrency),
        ]);
      this.logger.debug("getDealsMetrics succeeded");
      return {
        currency: targetCurrency,
        statCards,
        revenueForecast,
        dealsByStage: dealsByStage as { stageName: string; count: number }[],
        valueByStage: valueByStage as { stageName: string; value: number }[],
        dealsBySource,
        dealsByDepartment,
        atRiskDeals,
      };
    } catch (err) {
      this.logger.error(`getDealsMetrics failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async getStatCards(tenantId: string, months: number, targetCurrency: string): Promise<DashboardStatCards> {
    this.logger.debug(`getStatCards called (tenantId=${tenantId})`);
    const openDeals = await this.dealsRepo.find({ where: { tenantId, status: DealStatus.Open } });
    const totalDeals = await this.dealsRepo.count({ where: { tenantId } });
    const pipelineValue = openDeals.reduce(
      (sum, deal) =>
        sum + (deal.estimatedValue ? this.convertTo(Number(deal.estimatedValue), deal.currency, targetCurrency) : 0),
      0,
    );

    const since = monthsAgo(months);
    const winLossRatePercent = await this.getWinLossRatePercent(tenantId, since);

    const marginableDeals = (await this.dealsRepo.find({ where: { tenantId } })).filter(
      (deal) => deal.estimatedValue && Number(deal.estimatedValue) > 0,
    );
    const avgGpMarginPercent =
      marginableDeals.length > 0
        ? marginableDeals.reduce((sum, deal) => sum + computeMarginPercent(deal), 0) / marginableDeals.length
        : 0;

    const salesVelocityDays = await this.getAverageSalesVelocityDays(tenantId, since);

    this.logger.debug(
      `getStatCards resolved: totalDeals=${totalDeals}, pipelineValue=${pipelineValue.toFixed(2)} ${targetCurrency}, winLossRatePercent=${winLossRatePercent.toFixed(1)}`,
    );
    return {
      totalDeals,
      pipelineValue,
      winLossRatePercent,
      avgGpMarginPercent,
      salesVelocityDays,
    };
  }

  // The deal's own `status` is the authoritative terminal marker (it's what
  // moveStage() sets), but its timestamp of closing must come from the
  // stage-history row that actually flipped it -- deal.updatedAt is
  // unreliable for this (any later edit, e.g. a note, bumps it). Takes the
  // MOST RECENT won/lost-flagged move per deal, in case of a reopen/re-close
  // cycle, so a deal closed long ago and only recently reopened+reclosed is
  // correctly counted in the new window, not the old one.
  private async getWinLossRatePercent(tenantId: string, since: Date): Promise<number> {
    const rows: { deal_id: string; status: DealStatus }[] = await this.mainStageHistoryRepo.query(
      `SELECT DISTINCT ON (msh.deal_id) msh.deal_id, d.status
         FROM main_stage_history msh
         JOIN deals d ON d.id = msh.deal_id
         JOIN main_stages ms ON ms.id = msh.to_stage_id
        WHERE d.tenant_id = $1 AND (ms.is_won = true OR ms.is_lost = true) AND d.status IN ('won', 'lost')
          AND msh.moved_at >= $2
        ORDER BY msh.deal_id, msh.moved_at DESC`,
      [tenantId, since],
    );
    if (rows.length === 0) return 0;
    const wonCount = rows.filter((row) => row.status === DealStatus.Won).length;
    return (wonCount / rows.length) * 100;
  }

  private async getAverageSalesVelocityDays(tenantId: string, since: Date): Promise<number> {
    const rows: { deal_id: string; created_at: Date; moved_at: Date }[] = await this.mainStageHistoryRepo.query(
      `SELECT msh.deal_id, d.created_at, msh.moved_at
         FROM main_stage_history msh
         JOIN deals d ON d.id = msh.deal_id
         JOIN main_stages ms ON ms.id = msh.to_stage_id
        WHERE d.tenant_id = $1 AND ms.is_won = true AND msh.moved_at >= $2`,
      [tenantId, since],
    );
    if (rows.length === 0) return 0;
    const totalDays = rows.reduce((sum, row) => sum + daysBetween(row.created_at, row.moved_at), 0);
    return totalDays / rows.length;
  }

  private async getRevenueForecast(
    tenantId: string,
    months: number,
    targetCurrency: string,
  ): Promise<DealsMetricsResponse["revenueForecast"]> {
    this.logger.debug(`getRevenueForecast called (tenantId=${tenantId}, months=${months})`);
    const since = monthsAgo(months);

    const wonRows: { month: string; estimated_value: string; currency: string }[] =
      await this.mainStageHistoryRepo.query(
        `SELECT to_char(msh.moved_at, 'YYYY-MM') AS month, d.estimated_value, d.currency
           FROM main_stage_history msh
           JOIN deals d ON d.id = msh.deal_id
           JOIN main_stages ms ON ms.id = msh.to_stage_id
          WHERE d.tenant_id = $1 AND ms.is_won = true AND msh.moved_at >= $2`,
        [tenantId, since],
      );

    const openDeals = await this.dealsRepo.find({
      where: { tenantId, status: DealStatus.Open },
      relations: ["mainStage"],
    });

    const buckets = new Map<string, { actual: number; projected: number }>();
    for (const row of wonRows) {
      const bucket = buckets.get(row.month) ?? { actual: 0, projected: 0 };
      bucket.actual += this.convertTo(Number(row.estimated_value ?? 0), row.currency, targetCurrency);
      buckets.set(row.month, bucket);
    }
    for (const deal of openDeals) {
      if (!deal.expectedCloseDate || !deal.estimatedValue) continue;
      const month = deal.expectedCloseDate.slice(0, 7);
      const weight = deal.mainStage?.weightPercent != null ? Number(deal.mainStage.weightPercent) / 100 : 0;
      const bucket = buckets.get(month) ?? { actual: 0, projected: 0 };
      bucket.projected += this.convertTo(Number(deal.estimatedValue), deal.currency, targetCurrency) * weight;
      buckets.set(month, bucket);
    }

    const sortedMonths = [...buckets.keys()].sort();
    this.logger.debug(`getRevenueForecast returning ${sortedMonths.length} month bucket(s)`);
    return sortedMonths.map((month) => ({ month, ...buckets.get(month)! }));
  }

  private async getDealsAndValueByStage(
    tenantId: string,
    mode: "count" | "value",
    targetCurrency: string,
  ): Promise<{ stageName: string; count: number }[] | { stageName: string; value: number }[]> {
    this.logger.debug(`getDealsAndValueByStage called (tenantId=${tenantId}, mode=${mode})`);
    const openDeals = await this.dealsRepo.find({
      where: { tenantId, status: DealStatus.Open },
      relations: ["mainStage"],
    });
    const byStage = new Map<string, { count: number; value: number; position: number }>();
    for (const deal of openDeals) {
      const stageName = deal.mainStage?.name ?? "Unassigned";
      const entry = byStage.get(stageName) ?? { count: 0, value: 0, position: deal.mainStage?.position ?? 999 };
      entry.count += 1;
      entry.value += deal.estimatedValue ? this.convertTo(Number(deal.estimatedValue), deal.currency, targetCurrency) : 0;
      byStage.set(stageName, entry);
    }
    const ordered = [...byStage.entries()].sort((a, b) => a[1].position - b[1].position);
    this.logger.debug(`getDealsAndValueByStage returning ${ordered.length} stage(s)`);
    if (mode === "count") {
      return ordered.map(([stageName, v]) => ({ stageName, count: v.count }));
    }
    return ordered.map(([stageName, v]) => ({ stageName, value: v.value }));
  }

  private async getDealsBySource(tenantId: string, months: number): Promise<DealsMetricsResponse["dealsBySource"]> {
    this.logger.debug(`getDealsBySource called (tenantId=${tenantId}, months=${months})`);
    const since = monthsAgo(months);
    const deals = await this.dealsRepo.find({
      where: { tenantId },
      relations: ["source"],
    });
    const inWindow = deals.filter((deal) => deal.createdAt >= since);
    const byKey = new Map<string, { month: string; sourceName: string; count: number }>();
    for (const deal of inWindow) {
      const month = deal.createdAt.toISOString().slice(0, 7);
      const sourceName = deal.source?.name ?? "Unknown";
      const key = `${month}::${sourceName}`;
      const entry = byKey.get(key) ?? { month, sourceName, count: 0 };
      entry.count += 1;
      byKey.set(key, entry);
    }
    const results = [...byKey.values()].sort((a, b) => a.month.localeCompare(b.month));
    this.logger.debug(`getDealsBySource returning ${results.length} row(s)`);
    return results;
  }

  private async getDealsByDepartment(tenantId: string): Promise<DealsMetricsResponse["dealsByDepartment"]> {
    this.logger.debug(`getDealsByDepartment called (tenantId=${tenantId})`);
    const openDeals = await this.dealsRepo.find({
      where: { tenantId, status: DealStatus.Open },
      relations: ["department"],
    });
    const byDept = new Map<string, number>();
    for (const deal of openDeals) {
      const name = deal.department?.name ?? "Unassigned";
      byDept.set(name, (byDept.get(name) ?? 0) + 1);
    }
    const results = [...byDept.entries()].map(([departmentName, count]) => ({ departmentName, count }));
    this.logger.debug(`getDealsByDepartment returning ${results.length} department(s)`);
    return results;
  }

  private async getAtRiskDeals(tenantId: string, targetCurrency: string): Promise<DealsMetricsResponse["atRiskDeals"]> {
    this.logger.debug(`getAtRiskDeals called (tenantId=${tenantId})`);
    const openDeals = await this.dealsRepo.find({
      where: { tenantId, status: DealStatus.Open },
      relations: ["mainStage", "currentStage"],
    });

    const results: DealsMetricsResponse["atRiskDeals"] = [];
    for (const deal of openDeals) {
      const lastMoveAt = await this.getLastStageMoveAt(deal.id, Boolean(deal.currentStageId));
      const daysStuck = daysBetween(lastMoveAt ?? deal.createdAt, new Date());
      if (daysStuck < AT_RISK_THRESHOLD_DAYS) continue;
      results.push({
        id: deal.id,
        name: deal.name,
        value: deal.estimatedValue ? this.convertTo(Number(deal.estimatedValue), deal.currency, targetCurrency) : 0,
        daysStuck: Math.round(daysStuck),
        stageName: deal.currentStage?.name ?? deal.mainStage?.name ?? "Unassigned",
      });
    }
    results.sort((a, b) => b.daysStuck - a.daysStuck);
    const top = results.slice(0, AT_RISK_LIMIT);
    this.logger.debug(`getAtRiskDeals found ${results.length} at-risk deal(s), returning top ${top.length}`);
    return top;
  }

  private async getLastStageMoveAt(dealId: string, hasSubStage: boolean): Promise<Date | null> {
    if (hasSubStage) {
      const [row] = await this.subStageHistoryRepo.find({
        where: { dealId },
        order: { movedAt: "DESC" },
        take: 1,
      });
      if (row) return row.movedAt;
    }
    const [row] = await this.mainStageHistoryRepo.find({
      where: { dealId },
      order: { movedAt: "DESC" },
      take: 1,
    });
    return row?.movedAt ?? null;
  }

  async getPartnersMetrics(): Promise<PartnersMetricsResponse> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`getPartnersMetrics called (tenantId=${tenantId})`);
    try {
      const partnerTypeIds = await this.relationshipTypesService.findSystemRoleTypeIds(SystemRole.Partner);
      if (partnerTypeIds.length === 0) {
        this.logger.debug("No relationship type flagged as Partner yet, returning an empty result");
        return { partnersInsight: [] };
      }

      const rows: { company_name: string; count: string }[] = await this.dealPartnersRepo.query(
        `SELECT c.name AS company_name, COUNT(*) AS count
           FROM deal_partners_map dpm
           JOIN deals d ON d.id = dpm.deal_id
           JOIN companies c ON c.id = dpm.company_id
           JOIN relationship_company_contact_map rccm
             ON rccm.company_id = dpm.company_id AND rccm.deleted_at IS NULL AND rccm.is_active = true
          WHERE d.tenant_id = $1 AND rccm.relationship_type_id = ANY($2::uuid[])
          GROUP BY c.name
          ORDER BY count DESC`,
        [tenantId, partnerTypeIds],
      );
      const partnersInsight = rows.map((row) => ({ companyName: row.company_name, count: Number(row.count) }));
      this.logger.debug(`getPartnersMetrics returning ${partnersInsight.length} partner(s)`);
      return { partnersInsight };
    } catch (err) {
      this.logger.error(`getPartnersMetrics failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async getTenantsMetrics(months: number): Promise<TenantsMetricsResponse> {
    this.logger.debug(`getTenantsMetrics called (months=${months}, platform-wide)`);
    try {
      const since = monthsAgo(months);
      const rows: { month: string; count: string }[] = await this.tenantsRepo.query(
        `SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
           FROM tenants_registry
          WHERE created_at >= $1
          GROUP BY month
          ORDER BY month`,
        [since],
      );
      const tenantGrowth = rows.map((row) => ({ month: row.month, count: Number(row.count) }));
      this.logger.debug(`getTenantsMetrics returning ${tenantGrowth.length} month bucket(s)`);
      return { tenantGrowth };
    } catch (err) {
      this.logger.error(`getTenantsMetrics failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async getUsersMetrics(): Promise<UsersMetricsResponse> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`getUsersMetrics called (tenantId=${tenantId})`);
    try {
      const rows: { role_name: string; count: string }[] = await this.rbacRoleUserMapRepo.query(
        `SELECT r.name AS role_name, COUNT(DISTINCT m.user_id) AS count
           FROM rbac_role_user_map m
           JOIN rbac_roles r ON r.id = m.role_id
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL
          GROUP BY r.name
          ORDER BY count DESC`,
        [tenantId],
      );
      const usersByRole = rows.map((row) => ({ roleName: row.role_name, count: Number(row.count) }));
      this.logger.debug(`getUsersMetrics returning ${usersByRole.length} role(s)`);
      return { usersByRole };
    } catch (err) {
      this.logger.error(`getUsersMetrics failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Tenant-wide, unlike every other Priority Tasks query in this codebase
  // (which are all per-user) -- resolves each task's CANONICAL current status
  // the same way PriorityTasksService.resolveCanonicalView does: a
  // board/holder-type row (placed/accepted/completed/archived) always wins
  // over a `delegated` tracker row for the same task, since a task can
  // legitimately have both is_current simultaneously (the delegator's
  // tracker + the recipient's holder row) -- a naive GROUP BY would double
  // count that task. DISTINCT ON picks exactly one canonical row per task.
  async getTasksMetrics(): Promise<TasksMetricsResponse> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`getTasksMetrics called (tenantId=${tenantId})`);
    try {
      const rows: { event_type: PriorityTaskFlowEventType }[] = await this.priorityTaskFlowRepo.query(
        `SELECT canonical.event_type
           FROM (
             SELECT DISTINCT ON (ptf.task_id) ptf.task_id, ptf.event_type
               FROM priority_task_flow ptf
               JOIN priority_tasks pt ON pt.id = ptf.task_id
              WHERE pt.tenant_id = $1 AND pt.deleted_at IS NULL AND ptf.is_current = true
              ORDER BY ptf.task_id,
                CASE ptf.event_type WHEN 'delegated' THEN 1 ELSE 0 END
           ) canonical`,
        [tenantId],
      );

      const completedCount = rows.filter((row) => row.event_type === PriorityTaskFlowEventType.Completed).length;
      const activeCount = rows.filter((row) => row.event_type !== PriorityTaskFlowEventType.Archived).length;
      const completionPercent = activeCount > 0 ? (completedCount / activeCount) * 100 : 0;

      this.logger.debug(
        `getTasksMetrics resolved: completedCount=${completedCount}, activeCount=${activeCount}, completionPercent=${completionPercent.toFixed(1)}`,
      );
      return { completedCount, activeCount, completionPercent };
    } catch (err) {
      this.logger.error(`getTasksMetrics failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

// Mirrors frontend/src/lib/deals/deal-display.ts::computeCosting's
// marginPercent formula exactly, so this endpoint's number matches what a
// deal's own detail page already shows -- kept in sync by hand since the two
// live in different packages with no shared runtime. Margin is a ratio, not
// a money amount, so it's currency-independent -- no conversion needed here.
function computeMarginPercent(deal: Deal): number {
  const value = Number(deal.estimatedValue ?? 0);
  if (value <= 0) return 0;
  const internal = Number(deal.internalCosts ?? 0);
  const external = Number(deal.externalCosts ?? 0);
  const profit = value - internal - external;
  return (profit / value) * 100;
}
