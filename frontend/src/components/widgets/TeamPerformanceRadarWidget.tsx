"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/** DUMMY preview data — swap for a real per-team performance-metric endpoint later. */
const DUMMY_DATA = [
  { metric: "Deals Closed", score: 82 },
  { metric: "Response Time", score: 68 },
  { metric: "Follow-ups", score: 74 },
  { metric: "Upsells", score: 55 },
  { metric: "Satisfaction", score: 90 },
];

export function TeamPerformanceRadarWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Team Performance</h2>
      <ResponsiveContainer width="100%" height="85%">
        <RadarChart data={DUMMY_DATA}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#6b7280" }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: "#6b7280" }} angle={90} domain={[0, 100]} />
          <Tooltip />
          <Radar
            dataKey="score"
            stroke="var(--color-crm-primary)"
            fill="var(--color-crm-primary)"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
