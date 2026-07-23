"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** DUMMY preview data — swap for a real deals-grouped-by-stage endpoint later. */
const DUMMY_DATA = [
  { stage: "Lead", deals: 14 },
  { stage: "Qualified", deals: 9 },
  { stage: "Proposal", deals: 5 },
  { stage: "Won", deals: 3 },
];

export function DealsByStageChartWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Deals by Stage</h2>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={DUMMY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Bar dataKey="deals" fill="var(--color-crm-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
