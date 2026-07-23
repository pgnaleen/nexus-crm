"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** DUMMY preview data — swap for a real monthly-revenue endpoint later. */
const DUMMY_DATA = [
  { month: "Feb", revenue: 18400 },
  { month: "Mar", revenue: 21200 },
  { month: "Apr", revenue: 19800 },
  { month: "May", revenue: 24600 },
  { month: "Jun", revenue: 27100 },
  { month: "Jul", revenue: 31500 },
];

export function RevenueTrendChartWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Revenue Trend</h2>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={DUMMY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-crm-primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-crm-primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
