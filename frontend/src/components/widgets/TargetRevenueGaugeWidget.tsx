"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Representing 75% quota attainment
const DUMMY_DATA = [
  { name: "Achieved", value: 750000 },
  { name: "Remaining", value: 250000 },
];

const COLORS = ["var(--color-crm-primary)", "#f1f5f9"];

const formatCurrency = (val: number) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
};

export function TargetRevenueGaugeWidget() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
      <h2 className="m-0 text-[15px] font-bold text-slate-800">Target vs. Actual</h2>
      <p className="mt-1 text-xs text-slate-500">Q3 Quota Attainment</p>

      <div className="relative mt-2 flex-1 min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={DUMMY_DATA}
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius={70}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              cornerRadius={5}
            >
              {DUMMY_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: any) => [formatCurrency(val as number), "Revenue"]} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
          <span className="text-2xl font-extrabold text-slate-800 tracking-tight">75%</span>
          <span className="text-[11px] font-medium text-slate-400 mt-0.5">$750k / $1M</span>
        </div>
      </div>
    </div>
  );
}
