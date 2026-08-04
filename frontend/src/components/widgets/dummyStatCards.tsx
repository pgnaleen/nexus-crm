import type { ReactNode } from "react";
import type { DashboardStatCards } from "@orelia/common";
import { StatCard } from "@/components/ui/StatCard";
import { formatDashboardAmount } from "@/lib/dashboard/currency-format";
import {
  ActivityIcon,
  CheckCircleIcon,
  DashboardIcon,
  FunnelIcon,
  SlidersIcon,
} from "@/components/ui/icons";

// Pipeline Coverage (the 6th card from the original mock) stays deferred --
// no revenue-target/quota concept exists in the schema yet, see
// widget-registry.tsx's comment on TargetRevenueGaugeWidget for the same gap.
export const STAT_CARD_KEYS = ["totalDeals", "pipelineValue", "winLossRate", "avgGp", "salesVelocity"] as const;

export interface WidgetEntry {
  label: string;
  node: ReactNode;
}

export function getStatWidgetEntries(statCards: DashboardStatCards, currency: string): Record<string, WidgetEntry> {
  return {
    totalDeals: {
      label: "Total Deals",
      node: <StatCard key="totalDeals" label="Total Deals" value={statCards.totalDeals} icon={<FunnelIcon size={16} />} />,
    },
    pipelineValue: {
      label: "Total Pipeline Value",
      node: (
        <StatCard
          key="pipelineValue"
          label="Total Pipeline Value"
          value={formatDashboardAmount(statCards.pipelineValue, currency)}
          icon={<ActivityIcon size={16} />}
        />
      ),
    },
    winLossRate: {
      label: "Win/Loss Rate",
      node: (
        <StatCard
          key="winLossRate"
          label="Win/Loss Rate"
          value={`${statCards.winLossRatePercent.toFixed(0)}% Won`}
          icon={<CheckCircleIcon size={16} />}
        />
      ),
    },
    avgGp: {
      label: "Avg GP Margin",
      node: (
        <StatCard
          key="avgGp"
          label="Avg GP Margin"
          value={`${statCards.avgGpMarginPercent.toFixed(0)}%`}
          icon={<SlidersIcon size={16} />}
        />
      ),
    },
    salesVelocity: {
      label: "Sales Velocity",
      node: (
        <StatCard
          key="salesVelocity"
          label="Sales Velocity"
          value={`${statCards.salesVelocityDays.toFixed(0)} Days`}
          icon={<DashboardIcon size={16} />}
        />
      ),
    },
  };
}
