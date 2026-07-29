"use client";

import { useState } from "react";
import { EmploymentStatus, PERMISSIONS } from "@orelia/common";
import type { DepartmentPickerResponse, EmployeeDetailResponse, EmployeeListItemResponse } from "@orelia/common";
import { deleteEmployee, getEmployee } from "@/lib/api/employees";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { BanIcon, EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { useAlert, useConfirm } from "@/components/providers/DialogProvider";
import { t } from "@/lib/i18n";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";
import { EmployeeExitDialog } from "./EmployeeExitDialog";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { EMPLOYMENT_STATUS_LABELS } from "./employeeLabels";

interface EmployeesWidgetProps {
  employees: EmployeeListItemResponse[];
  permissions: string[];
  departments: DepartmentPickerResponse[];
}

const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  active: { background: "#e6f7ee", color: "#1a9c5f" },
  on_leave: { background: "#fff4e5", color: "#b26a00" },
  terminated: { background: "#fdecec", color: "#c0392b" },
  resigned: { background: "#f3f4f6", color: "#6b7280" },
};

function isExited(status: EmploymentStatus | null): boolean {
  return status === EmploymentStatus.Terminated || status === EmploymentStatus.Resigned;
}

export function EmployeesWidget({ employees: initialEmployees, permissions, departments }: EmployeesWidgetProps) {
  const confirm = useConfirm();
  const { showError } = useAlert();
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingEmployeeId, setViewingEmployeeId] = useState<string | null>(null);
  // Story 1.4 -- edit needs the full record as pre-fill, fetched on demand
  // when the row's edit icon is clicked.
  const [editingDetail, setEditingDetail] = useState<EmployeeDetailResponse | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  // Story 1.5 -- exit ("Mark as Exited") and delete flows, launched from the
  // row's action icons like every other section's table.
  const [exitingEmployee, setExitingEmployee] = useState<EmployeeListItemResponse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Story 1.5 -- status filter so exited employees stay findable rather
  // than silently vanishing among the actives ("" = all statuses).
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | "">("");

  const canView = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.EMPLOYEES_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.EMPLOYEES_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.EMPLOYEES_DELETE);
  const canViewSensitive = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
  const canCreateLogin = permissions.includes(PERMISSIONS.USERS_CREATE);
  const showActionsColumn = canUpdate || canDelete;

  const filteredEmployees = employees.filter(
    (employee) =>
      (!search || employee.fullName.toLowerCase().includes(search.toLowerCase())) &&
      (!statusFilter || employee.employmentStatus === statusFilter),
  );

  const statusFilterOptions = [
    { value: "", label: t("employees.statusFilter.all") },
    ...Object.values(EmploymentStatus).map((value) => ({ value, label: EMPLOYMENT_STATUS_LABELS[value] })),
  ];

  function handleSaved(employee: EmployeeListItemResponse) {
    setEmployees((current) => [...current, employee].sort((a, b) => a.fullName.localeCompare(b.fullName)));
  }

  // Story 1.4 -- replace the edited row in place (AC: name/title/department/
  // status changes reflect in the directory immediately), re-sorting in case
  // the name changed.
  function handleUpdated(detail: EmployeeDetailResponse) {
    const listItem: EmployeeListItemResponse = {
      id: detail.id,
      fullName: detail.fullName,
      title: detail.title,
      departmentId: detail.departmentId,
      departmentName: detail.departmentName,
      employmentStatus: detail.employmentStatus,
    };
    setEmployees((current) =>
      current
        .map((employee) => (employee.id === listItem.id ? listItem : employee))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    );
  }

  async function startEdit(employee: EmployeeListItemResponse) {
    setLoadingEditId(employee.id);
    try {
      const detail = await getEmployee(employee.id);
      setEditingDetail(detail);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("employees.dialog.errors.loadFailed"));
    } finally {
      setLoadingEditId(null);
    }
  }

  // Story 1.5 -- soft delete; the row disappears from the directory (the
  // record stays recoverable at the DB level). The confirm explicitly steers
  // real departures toward "Mark as Exited" instead.
  async function initiateDelete(employee: EmployeeListItemResponse) {
    const ok = await confirm({
      title: t("employees.deleteConfirm.title"),
      message: t("employees.deleteConfirm.message", { name: employee.fullName }),
      confirmLabel: t("employees.deleteConfirm.confirmLabel"),
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(employee.id);
    try {
      await deleteEmployee(employee.id);
      setEmployees((current) => current.filter((item) => item.id !== employee.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("employees.errors.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{t("employees.title")}</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("employees.subtitle")}</p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            {t("employees.addButton")}
          </Button>
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
              placeholder={t("employees.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
          <div className="w-[180px]">
            <CustomSelect
              fullWidth
              label=""
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as EmploymentStatus | "")}
              options={statusFilterOptions}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {!canView ? (
          <div className="empty-state">
            <p className="empty-state-title">{t("employees.emptyState.title")}</p>
            <p className="empty-state-message">{t("employees.emptyState.noneExist")}</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{t("employees.emptyState.title")}</p>
            <p className="empty-state-message">
              {employees.length === 0
                ? t("employees.emptyState.noneExist")
                : t("employees.emptyState.noMatch")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("employees.table.name")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("employees.table.title")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("employees.table.department")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("employees.table.status")}
                </th>
                {showActionsColumn && (
                  <th
                    className="border-b border-[var(--color-border)] px-3 py-2.5"
                    aria-label={t("employees.table.actions")}
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const statusColors = employee.employmentStatus
                  ? STATUS_COLORS[employee.employmentStatus]
                  : undefined;
                return (
                  <tr
                    key={employee.id}
                    className="cursor-pointer transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f1f5f9]"
                    onClick={() => setViewingEmployeeId(employee.id)}
                  >
                    <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                      {employee.fullName}
                    </td>
                    <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                      {employee.title ? t(`employees.titles.${employee.title}`) : t("employees.notSet")}
                    </td>
                    <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                      {employee.departmentName ?? t("employees.notSet")}
                    </td>
                    <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                      {employee.employmentStatus ? (
                        <span
                          className="inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                          style={{
                            background: statusColors?.background,
                            color: statusColors?.color,
                          }}
                        >
                          {t(`employees.status.${employee.employmentStatus}`)}
                        </span>
                      ) : (
                        t("employees.notSet")
                      )}
                    </td>
                    {showActionsColumn && (
                      <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                        {canUpdate && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("employees.editAriaLabel", { name: employee.fullName })}
                            onClick={(e) => {
                              e.stopPropagation();
                              void startEdit(employee);
                            }}
                            disabled={loadingEditId === employee.id}
                          >
                            <EditIcon size={15} />
                          </button>
                        )}
                        {canUpdate && !isExited(employee.employmentStatus) && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("employees.exitAriaLabel", { name: employee.fullName })}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExitingEmployee(employee);
                            }}
                          >
                            <BanIcon size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            aria-label={t("employees.deleteAriaLabel", { name: employee.fullName })}
                            onClick={(e) => {
                              e.stopPropagation();
                              void initiateDelete(employee);
                            }}
                            disabled={deletingId === employee.id}
                          >
                            <TrashIcon size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {isAddOpen && (
        <EmployeeFormDialog
          departments={departments}
          canViewSensitive={canViewSensitive}
          canCreateLogin={canCreateLogin}
          onClose={() => setIsAddOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {editingDetail && (
        <EmployeeFormDialog
          departments={departments}
          canViewSensitive={canViewSensitive}
          initialDetail={editingDetail}
          onClose={() => setEditingDetail(null)}
          onSaved={handleSaved}
          onUpdated={handleUpdated}
        />
      )}

      {exitingEmployee && (
        <EmployeeExitDialog
          employee={exitingEmployee}
          onClose={() => setExitingEmployee(null)}
          onExited={handleUpdated}
        />
      )}

      {viewingEmployeeId && !editingDetail && !exitingEmployee && (
        <EmployeeDetailDialog
          employeeId={viewingEmployeeId}
          canViewSensitive={canViewSensitive}
          onClose={() => setViewingEmployeeId(null)}
        />
      )}
    </div>
  );
}
