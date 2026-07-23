"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

/** DUMMY preview data — swap for a real tasks-completed-vs-total endpoint later. */
const DUMMY_DATA = [{ name: "Completed", value: 72, fill: "var(--color-crm-primary)" }];

export function TaskCompletionDonutWidget() {
  return (
    <div className="relative h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Task Completion</h2>
      <ResponsiveContainer width="100%" height="85%">
        <RadialBarChart
          data={DUMMY_DATA}
          innerRadius="70%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          barSize={16}
        >
          <RadialBar dataKey="value" background={{ fill: "#f1f5f9" }} cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-6">
        <span className="text-2xl font-bold text-crm-text">72%</span>
        <span className="text-[11px] text-[var(--color-text-muted)]">of tasks done</span>
      </div>
    </div>
  );
}
