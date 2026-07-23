"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { ActingTenant, RbacResourceResponse, RbacRoleResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteRole } from "@/lib/api/roles";
import { Button } from "@/components/ui/Button";
import { EditIcon, SearchIcon, ShieldIcon, TrashIcon } from "@/components/ui/icons";
import { RoleFormDialog } from "@/components/layout/RoleFormDialog";
import { RolePermissionsDialog } from "@/components/layout/RolePermissionsDialog";
import { RoleDetailsDialog } from "@/components/layout/RoleDetailsDialog";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";

interface RolesTableWidgetProps {
  roles: RbacRoleResponse[];
  resources: RbacResourceResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; role: RbacRoleResponse }
  | { mode: "permissions"; role: RbacRoleResponse }
  | { mode: "view"; role: RbacRoleResponse }
  | null;

export function RolesTableWidget({
  roles: initialRoles,
  resources,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: RolesTableWidgetProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [search, setSearch] = useState("");

  const confirm = useConfirm();
  const { showError } = useAlert();

  const canView = permissions.includes(PERMISSIONS.RBAC_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.RBAC_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.RBAC_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.RBAC_DELETE);
  const canImpersonate = isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const filteredRoles = roles.filter(
    (role) => !search || role.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function initiateDelete(role: RbacRoleResponse) {
    const ok = await confirm({
      title: "Delete Role",
      message: `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(role.id);
    try {
      await deleteRole(role.id);
      setRoles((current) => current.filter((item) => item.id !== role.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(role: RbacRoleResponse) {
    setRoles((current) => {
      const exists = current.some((item) => item.id === role.id);
      return exists
        ? current.map((item) => (item.id === role.id ? role : item))
        : [...current, role].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  return (
    <div>
      {canImpersonate && (
        <TenantActingAsSwitcher tenants={tenants} currentTenantId={currentTenantId} actingTenant={actingTenant} />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Roles Management</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">Manage roles and their assigned permissions</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Role
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
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredRoles.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No roles found</p>
            <p className="empty-state-message">No roles match the current search.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Name
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Description
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Permissions
                </th>
                {showActionsColumn && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr
                  key={role.id}
                  className={
                    canView
                      ? "cursor-pointer transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f1f5f9]"
                      : "transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                  }
                  onClick={canView ? () => setDialogState({ mode: "view", role }) : undefined}
                >
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{role.name}</td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {role.description ?? <span className="text-[var(--color-text-muted)]">&mdash;</span>}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{role.resourceCount}</td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Manage permissions for ${role.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "permissions", role });
                          }}
                        >
                          <ShieldIcon size={15} />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${role.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "edit", role });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${role.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(role);
                          }}
                          disabled={deletingId === role.id}
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

      {dialogState && dialogState.mode !== "permissions" && dialogState.mode !== "view" && (
        <RoleFormDialog
          mode={dialogState.mode}
          role={"role" in dialogState ? dialogState.role : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}

      {dialogState?.mode === "permissions" && (
        <RolePermissionsDialog
          role={dialogState.role}
          resources={resources}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}

      {dialogState?.mode === "view" && (
        <RoleDetailsDialog
          role={dialogState.role}
          resources={resources}
          onClose={() => setDialogState(null)}
        />
      )}
    </div>
  );
}
