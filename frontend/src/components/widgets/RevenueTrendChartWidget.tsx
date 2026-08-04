"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyRevenuePoint } from "@orelia/common";
import { formatDashboardAmount } from "@/lib/dashboard/currency-format";

// Reuses the Deals bundle's revenueForecast series (`actual`) rather than a
// separate query -- same underlying won-deal revenue numbers, just rendered
// as a line instead of an area+forecast chart.
interface RevenueTrendChartWidgetProps {
  data: MonthlyRevenuePoint[];
  currency: string;
}

export function RevenueTrendChartWidget({ data, currency }: RevenueTrendChartWidgetProps) {
  const formatCurrency = (val: number) => formatDashboardAmount(val, currency);
  const chartData = data.map((point) => ({ month: point.month, revenue: point.actual }));

  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Revenue Trend</h2>
      {chartData.length === 0 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">No won deals yet</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(val: any) => [formatCurrency(val as number), "Revenue"]} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-crm-primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-crm-primary)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
