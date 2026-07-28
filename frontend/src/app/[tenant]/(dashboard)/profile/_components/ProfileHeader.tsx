import type { ReactNode } from "react";
import type { AuthSessionResponse, EmployeeDetailResponse } from "@orelia/common";
import { UserStatusBadge } from "@/components/ui/UserStatusBadge";
import { t } from "@/lib/i18n";
import { ProfileAvatar } from "./ProfileAvatar";

// Identity band above the tabs: who you are, at a glance, without having to
// pick a tab first. Server component -- pure display.
//
// The photo lives here rather than inside the Employee Record tab (where it
// used to be) so it doesn't disappear the moment you switch tabs, and so the
// same image isn't rendered twice on one page.

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]">
      {children}
    </span>
  );
}

export function ProfileHeader({
  session,
  record,
}: {
  session: AuthSessionResponse;
  record: EmployeeDetailResponse | null;
}) {
  const { user, tenant, roles } = session;
  const photo = record?.profilePhotoDisplayUrl;

  // Designation is the more meaningful line when HR has one on file; the
  // username is the fallback for accounts with no linked employee record.
  const subtitle = record?.currentDesignation || user.username;

  return (
    <div className="content-card">
      <div className="flex flex-wrap items-center gap-5">
        {/* Editable only when there's a linked employee record -- the photo
            hangs off that record, so there's nothing to attach it to without
            one. Unlinked accounts still get the initials circle, just inert. */}
        <ProfileAvatar displayName={user.displayName} photoUrl={photo ?? null} editable={Boolean(record)} />

        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[26px] leading-tight font-bold text-crm-text">
            {user.displayName}
          </h1>
          <p className="m-0 mt-1 truncate text-sm text-[var(--color-text-muted)]">{subtitle}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <UserStatusBadge status={user.status} />
            {record?.departmentName && <Chip>{record.departmentName}</Chip>}
            <Chip>{tenant.name}</Chip>
            {roles.length > 0 && <Chip>{roles.join(", ")}</Chip>}
          </div>
        </div>
      </div>

      {!record && (
        <p className="mt-5 mb-0 rounded-lg bg-[var(--color-bg)] px-3.5 py-3 text-[12.5px] text-[var(--color-text-muted)]">
          {t("profile.header.noEmployeeRecord")}
        </p>
      )}
    </div>
  );
}
