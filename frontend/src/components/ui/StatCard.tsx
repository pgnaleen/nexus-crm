import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-3.5">
      <div className="mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-crm-primary-tint text-crm-primary">
        {icon}
      </div>
      <div className="text-[19px] font-bold text-crm-text">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
