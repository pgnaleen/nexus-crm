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

      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Roles Management</h1>
          <p className="funnel-subtitle">Manage roles and their assigned permissions</p>
        </div>
        {canCreate && (
          <button type="button" className="funnel-add-btn" onClick={() => setDialogState({ mode: "create" })}>
            Add Role
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Permissions</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr
                  key={role.id}
                  className={canView ? "interactive-row" : undefined}
                  onClick={canView ? () => setDialogState({ mode: "view", role }) : undefined}
                >
                  <td>{role.name}</td>
                  <td>{role.description ?? <span style={{ color: "var(--color-text-muted)" }}>&mdash;</span>}</td>
                  <td>{role.resourceCount}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
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
