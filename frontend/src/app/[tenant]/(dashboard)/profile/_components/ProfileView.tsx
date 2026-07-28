import type { ReactNode } from "react";
import type { AuthSessionResponse } from "@orelia/common";
import { UserStatusBadge } from "@/components/ui/UserStatusBadge";
import { t } from "@/lib/i18n";

interface ProfileViewProps {
  session: AuthSessionResponse;
}

// Pinned to a fixed zone so this renders identically during SSR and client
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
    { label: t("profile.account.displayName"), value: user.displayName },
    { label: t("profile.account.username"), value: user.username },
    { label: t("profile.account.loginEmail"), value: user.loggingEmail },
    { label: t("profile.account.status"), value: <UserStatusBadge status={user.status} /> },
    {
      label: t("profile.account.roles"),
      value: roles.length > 0 ? roles.join(", ") : t("profile.account.noRoles"),
    },
    { label: t("profile.account.tenant"), value: tenant.name },
    {
      label: t("profile.account.lastLogin"),
      value: user.lastLoggingAt
        ? formatDateTime(user.lastLoggingAt)
        : t("profile.account.neverLoggedIn"),
    },
  ];

  return (
    <div>
      <p className="m-0 mb-4 text-[12.5px] text-[var(--color-text-muted)]">
        {t("profile.account.hint")}
      </p>

      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-0">
        {rows.map((row) => (
          <div className="mb-4" key={row.label}>
            <dt className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
              {row.label}
            </dt>
            <dd className="m-0 text-sm font-medium text-crm-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
