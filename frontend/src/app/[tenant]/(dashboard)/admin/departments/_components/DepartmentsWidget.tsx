"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import type { ActingTenant, DepartmentResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteDepartment } from "@/lib/api/departments";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { DepartmentFormDialog } from "./DepartmentFormDialog";

interface DepartmentsWidgetProps {
  departments: DepartmentResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; department: DepartmentResponse }
  | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
  });
}

export function DepartmentsWidget({
  departments: initialDepartments,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: DepartmentsWidgetProps) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError } = useAlert();

  const canView   = permissions.includes(PERMISSIONS.DEPARTMENT_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.DEPARTMENT_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.DEPARTMENT_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.DEPARTMENT_DELETE);
  const canImpersonate =
    isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const filteredDepartments = departments.filter(
    (d) => !search || d.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSaved(department: DepartmentResponse) {
    setDepartments((current) => {
      const exists = current.some((item) => item.id === department.id);
      return exists
        ? current.map((item) => (item.id === department.id ? department : item))
        : [...current, department].sort((a, b) => a.name.localeCompare(b.name));
    });
    router.refresh();
  }

  async function initiateDelete(department: DepartmentResponse) {
    const ok = await confirm({
      title: "Delete Department",
      message: `Are you sure you want to delete "${department.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(department.id);
    try {
      await deleteDepartment(department.id);
      setDepartments((current) => current.filter((item) => item.id !== department.id));
      router.refresh();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete department");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="tenant-management-wrapper">
      {canImpersonate && (
        <TenantActingAsSwitcher
          tenants={tenants}
          currentTenantId={currentTenantId}
          actingTenant={actingTenant}
        />
      )}

      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Department Management</h1>
          <p className="funnel-subtitle">Configure organizational departments</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Department
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredDepartments.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No departments found</p>
            <p className="empty-state-message">
              {departments.length === 0
                ? "No departments exist yet. Add your first department."
                : "No departments match your search."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((department) => (
                <tr
                  key={department.id}
                  className={canUpdate ? "interactive-row" : undefined}
                  onClick={
                    canUpdate
                      ? () => setDialogState({ mode: "edit", department })
                      : undefined
                  }
                >
                  <td style={{ fontWeight: 500 }}>{department.name}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: department.isActive ? "#e6f7ee" : "#f3f4f6",
                        color: department.isActive ? "#1a9c5f" : "#6b7280",
                      }}
                    >
                      {department.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(department.createdAt)}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${department.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "edit", department });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${department.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(department);
                          }}
                          disabled={deletingId === department.id}
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

      {dialogState && (
        <DepartmentFormDialog
          mode={dialogState.mode}
          department={dialogState.mode === "edit" ? dialogState.department : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
