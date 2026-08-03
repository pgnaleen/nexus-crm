"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** DUMMY preview data — swap for a real deals-by-source-per-month endpoint later. */
const DUMMY_DATA = [
  { month: "Apr", apollo: 12, manual: 8, partner: 5 },
  { month: "May", apollo: 15, manual: 10, partner: 7 },
  { month: "Jun", apollo: 14, manual: 12, partner: 6 },
  { month: "Jul", apollo: 18, manual: 14, partner: 9 },
];

export function DealsBySourceStackedBarWidget() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Deals by Source</h2>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={DUMMY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="apollo" name="Apollo" stackId="a" fill="var(--color-crm-primary)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="manual" name="Manual" stackId="a" fill="var(--color-crm-primary-hover)" />
          <Bar dataKey="partner" name="Partner" stackId="a" fill="#f2b8bd" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
