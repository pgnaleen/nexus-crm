import { UserStatus } from "@orelia/common";

const STATUS_STYLES: Record<UserStatus, { bg: string; color: string; label: string }> = {
  [UserStatus.Active]: { bg: "#e6f7ee", color: "#1a9c5f", label: "Active" },
  [UserStatus.Invited]: { bg: "#eef1fb", color: "#2f6feb", label: "Invited" },
  [UserStatus.Disabled]: { bg: "#f3f4f6", color: "#6b7280", label: "Disabled" },
  [UserStatus.Locked]: { bg: "#fdf0ee", color: "#c0392b", label: "Locked" },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className="status-badge" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}
