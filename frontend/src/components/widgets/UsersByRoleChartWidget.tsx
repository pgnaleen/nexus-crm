"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/** DUMMY preview data — swap for a real users-grouped-by-role endpoint later. */
const DUMMY_DATA = [
  { name: "Sales Rep", value: 34 },
  { name: "Manager", value: 12 },
  { name: "Admin", value: 6 },
  { name: "Support", value: 18 },
];

// No blue, per the client's brand-color rule (CLAUDE.md) -- red family + neutral grey only.
const SLICE_COLORS = ["var(--color-crm-primary)", "var(--color-crm-primary-hover)", "#f2b8bd", "#6b7280"];

export function UsersByRoleChartWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Users by Role</h2>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie data={DUMMY_DATA} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
            {DUMMY_DATA.map((entry, index) => (
              <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
