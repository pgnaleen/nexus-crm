"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import type { TasksMetricsResponse } from "@orelia/common";

interface TaskCompletionDonutWidgetProps {
  data: TasksMetricsResponse;
}

export function TaskCompletionDonutWidget({ data }: TaskCompletionDonutWidgetProps) {
  const percent = Math.round(data.completionPercent);
  const chartData = [{ name: "Completed", value: percent, fill: "var(--color-crm-primary)" }];

  return (
    <div className="relative h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Task Completion</h2>
      <ResponsiveContainer width="100%" height="85%">
        <RadialBarChart
          data={chartData}
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
        <span className="text-2xl font-bold text-crm-text">{percent}%</span>
        <span className="text-[11px] text-[var(--color-text-muted)]">of tasks done</span>
      </div>
    </div>
  );
}
