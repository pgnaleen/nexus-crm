"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SourceMonthCount } from "@orelia/common";

interface DealsBySourceStackedBarWidgetProps {
  data: SourceMonthCount[];
}

const BAR_COLORS = ["var(--color-crm-primary)", "var(--color-crm-primary-hover)", "#f2b8bd", "#f6d0d4", "#6b7280"];

// The backend returns one flat row per (month, source) -- pivoted here into
// one row per month with a dynamic key per source name, since recharts'
// stacked bar needs a wide shape and the set of sources isn't fixed ahead of
// time (deal sources are tenant-configurable).
function pivotByMonth(data: SourceMonthCount[]): { rows: Record<string, string | number>[]; sourceNames: string[] } {
  const sourceNames = [...new Set(data.map((row) => row.sourceName))];
  const byMonth = new Map<string, Record<string, string | number>>();
  for (const row of data) {
    const entry = byMonth.get(row.month) ?? { month: row.month };
    entry[row.sourceName] = row.count;
    byMonth.set(row.month, entry);
  }
  const rows = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, row]) => row);
  return { rows, sourceNames };
}

export function DealsBySourceStackedBarWidget({ data }: DealsBySourceStackedBarWidgetProps) {
  const { rows, sourceNames } = pivotByMonth(data);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Deals by Source</h2>
      {rows.length === 0 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">No deals yet</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sourceNames.map((name, index) => (
              <Bar
                key={name}
                dataKey={name}
                name={name}
                stackId="a"
                fill={BAR_COLORS[index % BAR_COLORS.length]}
                radius={index === sourceNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
