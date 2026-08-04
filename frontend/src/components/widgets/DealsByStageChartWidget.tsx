"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StageCount } from "@orelia/common";

interface DealsByStageChartWidgetProps {
  data: StageCount[];
}

export function DealsByStageChartWidget({ data }: DealsByStageChartWidgetProps) {
  const chartData = data.map((row) => ({ stage: row.stageName, deals: row.count }));

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Deal Count by Stage</h2>
      {chartData.length === 0 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">No open deals</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip />
            <Bar dataKey="deals" fill="var(--color-crm-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
