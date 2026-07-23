"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** DUMMY preview data — swap for a real tenants-created-per-month endpoint later. */
const DUMMY_DATA = [
  { month: "Feb", tenants: 4 },
  { month: "Mar", tenants: 6 },
  { month: "Apr", tenants: 7 },
  { month: "May", tenants: 9 },
  { month: "Jun", tenants: 10 },
  { month: "Jul", tenants: 12 },
];

export function TenantGrowthChartWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Tenant Growth</h2>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={DUMMY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="tenantGrowthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-crm-primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-crm-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="tenants"
            stroke="var(--color-crm-primary)"
            strokeWidth={2}
            fill="url(#tenantGrowthFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
