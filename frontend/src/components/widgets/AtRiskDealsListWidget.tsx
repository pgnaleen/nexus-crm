"use client";

import { ActivityIcon } from "@/components/ui/icons";
import type { AtRiskDealSummary } from "@orelia/common";
import { formatDashboardAmount } from "@/lib/dashboard/currency-format";

interface AtRiskDealsListWidgetProps {
  data: AtRiskDealSummary[];
  currency: string;
}

export function AtRiskDealsListWidget({ data, currency }: AtRiskDealsListWidgetProps) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-slate-800">Top 5 At-Risk Deals</h2>
          <p className="mt-1 text-xs text-slate-500">High value deals stuck in stage</p>
        </div>
        <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center text-crm-primary">
          <ActivityIcon size={16} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No deals currently at risk
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="truncate text-sm font-semibold text-slate-800" title={deal.name}>{deal.name}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <span>{deal.stageName}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-orange-500 font-medium">Stuck {deal.daysStuck} days</span>
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-extrabold text-slate-800">
                  {formatDashboardAmount(deal.value, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
