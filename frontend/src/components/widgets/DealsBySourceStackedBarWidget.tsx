"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** DUMMY preview data — swap for a real deals-by-source-per-month endpoint later. */
const DUMMY_DATA = [
  { month: "Apr", referral: 6, website: 9, coldCall: 3 },
  { month: "May", referral: 8, website: 11, coldCall: 4 },
  { month: "Jun", referral: 7, website: 14, coldCall: 5 },
  { month: "Jul", referral: 10, website: 16, coldCall: 6 },
];

export function DealsBySourceStackedBarWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Deals by Source</h2>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={DUMMY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="referral" stackId="a" fill="var(--color-crm-primary)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="website" stackId="a" fill="var(--color-crm-primary-hover)" />
          <Bar dataKey="coldCall" stackId="a" fill="#f2b8bd" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
