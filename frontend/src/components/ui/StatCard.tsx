import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="group rounded-xl bg-white p-3.5 shadow-[0_1.5px_4px_rgba(15,23,42,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200/80">
      <div className="mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-crm-primary-tint text-crm-primary">
        {icon}
      </div>
      <div className="text-[19px] font-bold text-crm-text">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
