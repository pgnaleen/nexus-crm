"use client";

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";

/** DUMMY preview data — swap for a real deals-by-stage-count-descending endpoint later. */
const DUMMY_DATA = [
  { name: "Leads", value: 240, fill: "var(--color-crm-primary)" },
  { name: "Qualified", value: 160, fill: "var(--color-crm-primary-hover)" },
  { name: "Proposal", value: 90, fill: "#f2b8bd" },
  { name: "Negotiation", value: 45, fill: "#f6d0d4" },
  { name: "Won", value: 22, fill: "#6b7280" },
];

export function SalesFunnelDiagramWidget() {
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <h2 className="m-0 mb-3 text-sm font-semibold text-crm-text">Sales Funnel</h2>
      <ResponsiveContainer width="100%" height="85%">
        <FunnelChart>
          <Tooltip />
          <Funnel dataKey="value" data={DUMMY_DATA} isAnimationActive>
            <LabelList position="right" dataKey="name" fill="#0f172a" stroke="none" fontSize={11} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
