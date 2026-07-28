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
import { t } from "@/lib/i18n";
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
  | { mode: "edit" | "view"; department: DepartmentResponse }
  | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
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
      title: t("departments.deleteConfirm.title"),
      message: t("departments.deleteConfirm.message", { name: department.name }),
      confirmLabel: t("departments.deleteConfirm.confirmLabel"),
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(department.id);
    try {
      await deleteDepartment(department.id);
      setDepartments((current) => current.filter((item) => item.id !== department.id));
      router.refresh();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("departments.errors.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      {canImpersonate && (
        <TenantActingAsSwitcher
          tenants={tenants}
          currentTenantId={currentTenantId}
          actingTenant={actingTenant}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{t("departments.title")}</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("departments.subtitle")}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            {t("departments.addButton")}
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3 rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder={t("departments.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredDepartments.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{t("departments.emptyState.title")}</p>
            <p className="empty-state-message">
              {departments.length === 0
                ? t("departments.emptyState.noneExist")
                : t("departments.emptyState.noMatch")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("departments.table.name")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("departments.table.status")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("departments.table.created")}
                </th>
                {showActionsColumn && (
                  <th
                    className="border-b border-[var(--color-border)] px-3 py-2.5"
                    aria-label={t("departments.table.actions")}
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((department) => (
                <tr
                  key={department.id}
                  className="transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                >
                  <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                    {department.name}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    <span
                      className="inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                      style={{
                        background: department.isActive ? "#e6f7ee" : "#f3f4f6",
                        color: department.isActive ? "#1a9c5f" : "#6b7280",
                      }}
                    >
                      {department.isActive
                        ? t("departments.table.statusActive")
                        : t("departments.table.statusInactive")}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {formatDate(department.createdAt)}
                  </td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t("departments.editAriaLabel", { name: department.name })}
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
                          aria-label={t("departments.deleteAriaLabel", { name: department.name })}
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
          </div>
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
