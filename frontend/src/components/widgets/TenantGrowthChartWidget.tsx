"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface TenantGrowthChartWidgetProps {
  data: { month: string; count: number }[];
}

export function TenantGrowthChartWidget({ data }: TenantGrowthChartWidgetProps) {
  const chartData = data.map((row) => ({ month: row.month, tenants: row.count }));

  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Tenant Growth</h2>
      {chartData.length === 0 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">No tenants yet</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
      )}
    </div>
  );
}
