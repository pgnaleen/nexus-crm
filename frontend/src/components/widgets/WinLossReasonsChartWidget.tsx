"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DUMMY_DATA = [
  { reason: "Competitor Price", count: 18 },
  { reason: "Missing Feature", count: 12 },
  { reason: "Timing", count: 8 },
  { reason: "Budget", count: 5 },
  { reason: "No Decision", count: 3 },
];

export function WinLossReasonsChartWidget() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <div>
        <h2 className="m-0 text-[15px] font-bold text-slate-800">Closed Lost Reasons</h2>
        <p className="mt-1 text-xs text-slate-500">Why deals were lost this quarter</p>
      </div>
      
      <div className="flex-1 mt-4 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DUMMY_DATA} layout="vertical" margin={{ top: 0, right: 10, left: 25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis dataKey="reason" type="category" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={90} />
            <Tooltip cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="count" fill="#475569" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
