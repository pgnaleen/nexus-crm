"use client";

import { ActivityIcon } from "@/components/ui/icons";

const DUMMY_RISK_DEALS = [
  { id: 1, name: "Stark Industries - Enterprise Server Migration", value: 450000, daysStuck: 45, stage: "Proposal" },
  { id: 2, name: "Wayne Enterprises - Security Audit", value: 320000, daysStuck: 38, stage: "Qualified" },
  { id: 3, name: "Oscorp Corp - Web Platform", value: 180000, daysStuck: 29, stage: "Negotiation" },
  { id: 4, name: "Acme Corp - Cloud Transition", value: 150000, daysStuck: 21, stage: "Proposal" },
  { id: 5, name: "Initech - Software Licensing", value: 95000, daysStuck: 19, stage: "Lead" },
];

const formatCurrency = (val: number) => {
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
};

export function AtRiskDealsListWidget() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-slate-800">Top 5 At-Risk Deals</h2>
          <p className="mt-1 text-xs text-slate-500">High value deals stuck in stage</p>
        </div>
        <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center text-crm-primary">
          <ActivityIcon size={16} />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="space-y-3">
          {DUMMY_RISK_DEALS.map((deal) => (
            <div key={deal.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex flex-col min-w-0 pr-4">
                <span className="truncate text-sm font-semibold text-slate-800" title={deal.name}>{deal.name}</span>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                  <span>{deal.stage}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-orange-500 font-medium">Stuck {deal.daysStuck} days</span>
                </div>
              </div>
              <span className="shrink-0 text-[13px] font-extrabold text-slate-800">
                {formatCurrency(deal.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
