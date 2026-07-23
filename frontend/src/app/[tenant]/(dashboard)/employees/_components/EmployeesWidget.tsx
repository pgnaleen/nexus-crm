"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { DepartmentPickerResponse, EmployeeDetailResponse, EmployeeListItemResponse } from "@orelia/common";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";
import { EmployeeFormDialog } from "./EmployeeFormDialog";

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

export function EmployeesWidget({ employees: initialEmployees, permissions, departments }: EmployeesWidgetProps) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingEmployeeId, setViewingEmployeeId] = useState<string | null>(null);
  // Story 1.4 -- detail loaded via the view dialog, handed to the form
  // dialog as edit-mode pre-fill.
  const [editingDetail, setEditingDetail] = useState<EmployeeDetailResponse | null>(null);

  const canView = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.EMPLOYEES_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.EMPLOYEES_UPDATE);
  const canViewSensitive = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);

  const filteredEmployees = employees.filter(
    (employee) => !search || employee.fullName.toLowerCase().includes(search.toLowerCase()),
  );

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

      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-4">
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isAddOpen && (
        <EmployeeFormDialog
          departments={departments}
          canViewSensitive={canViewSensitive}
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

      {viewingEmployeeId && !editingDetail && (
        <EmployeeDetailDialog
          employeeId={viewingEmployeeId}
          canViewSensitive={canViewSensitive}
          onClose={() => setViewingEmployeeId(null)}
          onEdit={
            canUpdate
              ? (detail) => {
                  setViewingEmployeeId(null);
                  setEditingDetail(detail);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
