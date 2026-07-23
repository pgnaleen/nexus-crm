"use client";

import { useState } from "react";
import { PERMISSIONS, UserStatus } from "@orelia/common";
import type { ActingTenant, TenantSummaryResponse, UserResponse, UserSummaryResponse } from "@orelia/common";
import { deleteUser, disableUser, enableUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { BanIcon, CheckCircleIcon, EditIcon, KeyIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { UserStatusBadge } from "@/components/ui/UserStatusBadge";
import { UserDetailsDialog } from "@/components/layout/UserDetailsDialog";
import { UserFormDialog } from "@/components/layout/UserFormDialog";
import { ResetPasswordDialog } from "@/components/layout/ResetPasswordDialog";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";

interface UsersTableWidgetProps {
  users: UserSummaryResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type FormDialogState = { mode: "create" } | { mode: "edit"; user: UserSummaryResponse } | null;

// Pinned locale + timeZone so this renders identically during SSR (Docker
// container, no TZ set -> UTC) and client hydration (the browser's local
// timezone) -- letting toLocaleString() pick either machine's local
// settings causes a React hydration mismatch.
function formatLastLogin(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function UsersTableWidget({
  users: initialUsers,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: UsersTableWidgetProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [viewingUser, setViewingUser] = useState<UserSummaryResponse | null>(null);
  const [formDialogState, setFormDialogState] = useState<FormDialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserSummaryResponse | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError, showSuccess } = useAlert();

  const canView = permissions.includes(PERMISSIONS.USERS_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.USERS_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.USERS_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.USERS_DELETE);
  const canDisable = permissions.includes(PERMISSIONS.USERS_DISABLE);
  const canImpersonate = isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete || canDisable;

  const filteredUsers = users.filter(
    (user) =>
      !search ||
      user.displayName.toLowerCase().includes(search.toLowerCase()) ||
      user.username.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSaved(user: UserResponse) {
    setUsers((current) => {
      const exists = current.some((item) => item.id === user.id);
      return exists
        ? current.map((item) => (item.id === user.id ? user : item))
        : [...current, user].sort((a, b) => a.displayName.localeCompare(b.displayName));
    });
  }

  async function initiateDelete(user: UserSummaryResponse) {
    const ok = await confirm({
      title: "Delete User",
      message: `Are you sure you want to delete "${user.displayName}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  }

  async function initiateDisable(user: UserSummaryResponse) {
    const ok = await confirm({
      title: "Disable User",
      message: `Disable "${user.displayName}"? This immediately ends any active session and blocks login until re-enabled.`,
      confirmLabel: "Disable",
      isDestructive: true,
    });
    if (!ok) return;

    setTogglingStatusId(user.id);
    try {
      const updated = await disableUser(user.id);
      handleSaved(updated);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to disable user");
    } finally {
      setTogglingStatusId(null);
    }
  }

  async function handleEnable(user: UserSummaryResponse) {
    setTogglingStatusId(user.id);
    try {
      const updated = await enableUser(user.id);
      handleSaved(updated);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to enable user");
    } finally {
      setTogglingStatusId(null);
    }
  }

  return (
    <div className="flex flex-col">
      {canImpersonate && (
        <TenantActingAsSwitcher tenants={tenants} currentTenantId={currentTenantId} actingTenant={actingTenant} />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">User Management</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">Manage team access and permissions</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setFormDialogState({ mode: "create" })}
          >
            Add User
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No users found</p>
            <p className="empty-state-message">
              {users.length === 0
                ? "No users exist in this workspace yet."
                : "No users match the current search."}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Username
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Display Name
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Status
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Login Email
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Last Login
                </th>
                {showActionsColumn && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={
                    canView
                      ? "cursor-pointer transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f1f5f9]"
                      : "transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                  }
                  onClick={canView ? () => setViewingUser(user) : undefined}
                >
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{user.username}</td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{user.displayName}</td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{user.loggingEmail}</td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {user.lastLoggingAt ? (
                      formatLastLogin(user.lastLoggingAt)
                    ) : (
                      <span className="text-[var(--color-text-muted)]">&mdash;</span>
                    )}
                  </td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${user.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormDialogState({ mode: "edit", user });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Reset password for ${user.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setResettingPasswordUser(user);
                          }}
                        >
                          <KeyIcon size={15} />
                        </button>
                      )}
                      {canDisable && user.status !== UserStatus.Disabled && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Disable ${user.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDisable(user);
                          }}
                          disabled={togglingStatusId === user.id}
                        >
                          <BanIcon size={15} />
                        </button>
                      )}
                      {canDisable && user.status === UserStatus.Disabled && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Enable ${user.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnable(user);
                          }}
                          disabled={togglingStatusId === user.id}
                        >
                          <CheckCircleIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${user.displayName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(user);
                          }}
                          disabled={deletingId === user.id}
                        >
                          <TrashIcon size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewingUser && <UserDetailsDialog user={viewingUser} onClose={() => setViewingUser(null)} />}

      {formDialogState && (
        <UserFormDialog
          mode={formDialogState.mode}
          user={"user" in formDialogState ? formDialogState.user : undefined}
          onClose={() => setFormDialogState(null)}
          onSaved={handleSaved}
        />
      )}

      {resettingPasswordUser && (
        <ResetPasswordDialog
          user={resettingPasswordUser}
          onClose={() => setResettingPasswordUser(null)}
          onReset={() => showSuccess(`Password reset for ${resettingPasswordUser.displayName}.`, "Password Reset")}
        />
      )}
    </div>
  );
}
