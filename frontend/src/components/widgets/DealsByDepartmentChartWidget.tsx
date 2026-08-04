"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { DepartmentCount } from "@orelia/common";

interface DealsByDepartmentChartWidgetProps {
  data: DepartmentCount[];
}

const COLORS = ["var(--color-crm-primary)", "var(--color-crm-primary-hover)", "#f2b8bd", "#f6d0d4", "#6b7280"];

export function DealsByDepartmentChartWidget({ data }: DealsByDepartmentChartWidgetProps) {
  const chartData = data.map((row) => ({ name: row.departmentName, value: row.count }));

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Department Wise Deals</h2>
      <div className="flex-1 min-h-0">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No open deals</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
