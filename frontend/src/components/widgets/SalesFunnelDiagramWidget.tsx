"use client";

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";
import type { StageCount } from "@orelia/common";

// Reuses the Deals bundle's dealsByStage series rather than a separate
// query -- same open-deals-by-stage counts, rendered as a funnel instead of
// a bar chart.
interface SalesFunnelDiagramWidgetProps {
  data: StageCount[];
}

const FUNNEL_COLORS = ["var(--color-crm-primary)", "var(--color-crm-primary-hover)", "#f2b8bd", "#f6d0d4", "#6b7280"];

export function SalesFunnelDiagramWidget({ data }: SalesFunnelDiagramWidgetProps) {
  const chartData = data.map((row, index) => ({
    name: row.stageName,
    value: row.count,
    fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
  }));

  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Sales Funnel</h2>
      {chartData.length === 0 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">No open deals</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={chartData} isAnimationActive>
              <LabelList position="right" dataKey="name" fill="#0f172a" stroke="none" fontSize={11} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
