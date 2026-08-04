"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RoleCount } from "@orelia/common";

interface UsersByRoleChartWidgetProps {
  data: RoleCount[];
}

// No blue, per the client's brand-color rule (CLAUDE.md) -- red family + neutral grey only.
const SLICE_COLORS = ["var(--color-crm-primary)", "var(--color-crm-primary-hover)", "#f2b8bd", "#6b7280"];

export function UsersByRoleChartWidget({ data }: UsersByRoleChartWidgetProps) {
  const chartData = data.map((row) => ({ name: row.roleName, value: row.count }));

  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Users by Role</h2>
      {chartData.length === 0 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">No users yet</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
