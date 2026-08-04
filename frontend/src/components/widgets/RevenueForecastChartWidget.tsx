"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyRevenuePoint } from "@orelia/common";
import { formatDashboardAmount } from "@/lib/dashboard/currency-format";

interface RevenueForecastChartWidgetProps {
  data: MonthlyRevenuePoint[];
  currency: string;
}

export function RevenueForecastChartWidget({ data, currency }: RevenueForecastChartWidgetProps) {
  const formatCurrency = (val: number) => formatDashboardAmount(val, currency);
  const chartData = data.map((point) => ({
    month: point.month,
    actual: point.actual || null,
    projected: point.projected,
  }));

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-slate-800">Revenue Forecast</h2>
          <p className="mt-1 text-xs text-slate-500">Expected close value over time</p>
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No deals yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-crm-primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-crm-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(val: any) => [formatCurrency(val as number), "Revenue"]} wrapperStyle={{ borderRadius: "8px" }} />

              <Area type="monotone" dataKey="projected" stroke="var(--color-crm-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorProjected)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="actual" stroke="var(--color-crm-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorProjected)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
