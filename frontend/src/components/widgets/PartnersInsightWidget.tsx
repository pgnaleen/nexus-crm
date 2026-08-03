"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DUMMY_DATA = [
  { partner: "Acme Corp", deals: 12 },
  { partner: "Global Tech", deals: 8 },
  { partner: "Alpha Solutions", deals: 5 },
  { partner: "Omega Partners", deals: 3 },
];

export function PartnersInsightWidget() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Partners Insight</h2>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={DUMMY_DATA}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 30, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis dataKey="partner" type="category" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip />
          <Bar dataKey="deals" fill="var(--color-crm-primary)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
