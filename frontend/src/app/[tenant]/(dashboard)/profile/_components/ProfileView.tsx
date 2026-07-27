import type { ReactNode } from "react";
import type { AuthSessionResponse } from "@orelia/common";
import { UserStatusBadge } from "@/components/ui/UserStatusBadge";

interface ProfileViewProps {
  session: AuthSessionResponse;
}

// Pinned to UTC so this renders identically during SSR and client
// hydration -- matches the same convention used for Last Login in
// UsersTableWidget.tsx.
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProfileView({ session }: ProfileViewProps) {
  const { user, tenant, roles } = session;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Display Name", value: user.displayName },
    { label: "Username", value: user.username },
    { label: "Login Email", value: user.loggingEmail },
    { label: "Status", value: <UserStatusBadge status={user.status} /> },
    { label: "Roles", value: roles.length > 0 ? roles.join(", ") : "None assigned" },
    { label: "Tenant", value: tenant.name },
    {
      label: "Last Login",
      value: user.lastLoggingAt ? formatDateTime(user.lastLoggingAt) : "Not logged in yet",
    },
  ];

  return (
    <dl className="profile-info-grid">
      {rows.map((row) => (
        <div className="profile-info-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
