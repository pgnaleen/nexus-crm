import { TenantStatus } from "@orelia/common";

// Trial was previously a blue badge (#eef1fb/#2f6feb) -- switched to the same amber pairing used
// elsewhere for a neutral "pending" state, per the client's "no blue anywhere" rule.
const STATUS_STYLES: Record<TenantStatus, { bg: string; color: string; label: string }> = {
  [TenantStatus.Active]: { bg: "#e6f7ee", color: "#1a9c5f", label: "Active" },
  [TenantStatus.Trial]: { bg: "#fff7e6", color: "#b8860b", label: "Trial" },
  [TenantStatus.Suspended]: { bg: "#fdf0ee", color: "#c0392b", label: "Suspended" },
  [TenantStatus.Cancelled]: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
};

export function StatusBadge({ status }: { status: TenantStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}
