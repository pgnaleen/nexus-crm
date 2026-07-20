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
    <div className="tenant-management-wrapper">
      {canImpersonate && (
        <TenantActingAsSwitcher tenants={tenants} currentTenantId={currentTenantId} actingTenant={actingTenant} />
      )}

      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">User Management</h1>
          <p className="funnel-subtitle">Manage team access and permissions</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setFormDialogState({ mode: "create" })}
          >
            Add User
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Status</th>
                <th>Login Email</th>
                <th>Last Login</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={canView ? "interactive-row" : undefined}
                  onClick={canView ? () => setViewingUser(user) : undefined}
                >
                  <td>{user.username}</td>
                  <td>{user.displayName}</td>
                  <td>
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td>{user.loggingEmail}</td>
                  <td>{user.lastLoggingAt ? formatLastLogin(user.lastLoggingAt) : <span style={{ color: "var(--color-text-muted)" }}>&mdash;</span>}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
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
