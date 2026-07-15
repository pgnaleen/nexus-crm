import { TenantStatus } from "@orelia/common";

const STATUS_STYLES: Record<TenantStatus, { bg: string; color: string; label: string }> = {
  [TenantStatus.Active]: { bg: "#e6f7ee", color: "#1a9c5f", label: "Active" },
  [TenantStatus.Trial]: { bg: "#eef1fb", color: "#2f6feb", label: "Trial" },
  [TenantStatus.Suspended]: { bg: "#fdf0ee", color: "#c0392b", label: "Suspended" },
  [TenantStatus.Cancelled]: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
};

export function StatusBadge({ status }: { status: TenantStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className="status-badge" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}
