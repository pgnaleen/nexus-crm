"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EmployeeDetailResponse } from "@orelia/common";
import { getEmployee } from "@/lib/api/employees";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { UserIcon, UsersGroupIcon } from "@/components/ui/icons";
import { getInitials } from "@/lib/deals/deal-display";
import { t } from "@/lib/i18n";
import {
  CLEARANCE_LEVEL_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  TITLE_LABELS,
} from "./employeeLabels";

type TabId = "personal" | "employment" | "contact" | "confidential";

// Read-only view opened by clicking a directory row. Edit / Mark-as-Exited /
// Delete live on the row's action icons in EmployeesWidget (same pattern as
// every other section's table), NOT in this dialog.
interface EmployeeDetailDialogProps {
  employeeId: string;
  canViewSensitive: boolean;
  onClose: () => void;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">{label}</div>
      <div className="text-sm font-medium text-crm-text">{value || t("employees.notSet")}</div>
    </div>
  );
}

export function EmployeeDetailDialog({ employeeId, canViewSensitive, onClose }: EmployeeDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [detail, setDetail] = useState<EmployeeDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getEmployee(employeeId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : t("employees.dialog.errors.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const tabsOrder: TabId[] = ["personal", "employment", "contact", ...(canViewSensitive ? (["confidential"] as TabId[]) : [])];

  return (
    <Dialog
      open
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
            <UsersGroupIcon size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-bold text-crm-text truncate">
              {t("employees.dialog.viewTitle")}
            </span>
          </div>
        </div>
      }
      onClose={onClose}
      maxWidth="720px"
    >
      {/* Pill tab strip */}
      <div className="flex flex-nowrap items-center bg-slate-100/90 p-1 rounded-xl mb-6 select-none border border-slate-200/40 shadow-sm gap-1">
        {tabsOrder.map((id, idx) => {
          const isActive = activeTab === id;
          const TAB_ICONS: Record<TabId, React.ReactNode> = {
            personal: <UserIcon size={14} />,
            employment: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
            contact: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
            confidential: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
          };
          const TAB_LABELS: Record<TabId, string> = {
            personal: t("employees.dialog.tabs.personal"),
            employment: t("employees.dialog.tabs.employment"),
            contact: t("employees.dialog.tabs.contact"),
            confidential: t("employees.dialog.tabs.confidential"),
          };
          let clipPath = "";
          if (isActive) {
            const isFirst = idx === 0;
            const isLast = idx === tabsOrder.length - 1;
            if (isFirst) clipPath = "polygon(0 0, 100% 0, 88% 100%, 0 100%)";
            else if (isLast) clipPath = "polygon(12% 0, 100% 0, 100% 100%, 0 100%)";
            else clipPath = "polygon(12% 0, 100% 0, 88% 100%, 0 100%)";
          }
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center justify-center gap-1.5 py-1.5 px-3.5 font-bold transition-all duration-150 border-none outline-none focus:outline-none cursor-pointer shrink-0 rounded-lg ${
                isActive ? "text-white select-none" : "text-slate-550 hover:bg-slate-200/50 hover:text-slate-800"
              }`}
            >
              {isActive && (
                <div
                  className={`absolute inset-0 bg-crm-primary shadow-sm ${
                    idx === 0 ? "rounded-l-lg" : idx === tabsOrder.length - 1 ? "rounded-r-lg" : ""
                  }`}
                  style={{ clipPath }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 text-[12.5px] whitespace-nowrap">
                {TAB_ICONS[id]}
                {TAB_LABELS[id]}
              </span>
            </button>
          );
        })}
      </div>


      {loadError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {isLoading || !detail ? (
        // Same fixed height as the tab panels below, so the dialog doesn't
        // resize when the data arrives.
        <div className="dialog-loading h-[380px] items-center">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          {/* ── Tab 1: Personal ────────────────────────────── */}
          {activeTab === "personal" && (
            <div className="grid h-[380px] grid-cols-2 content-start gap-3.5 overflow-y-auto pr-1">
              <DetailItem label={t("employees.table.name")} value={detail.fullName} />
              <DetailItem label={t("employees.dialog.personal.dateOfBirth")} value={detail.dateOfBirth} />
              <DetailItem
                label={t("employees.dialog.personal.gender")}
                value={detail.gender ? GENDER_LABELS[detail.gender] : null}
              />
              <DetailItem label={t("employees.dialog.personal.nationality")} value={detail.nationality} />
              <div className="col-span-2">
                <DetailItem label={t("employees.dialog.personal.bio")} value={detail.bio} />
              </div>
              <div className="col-span-2">
                <div className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.personal.photo")}
                </div>
                {detail.profilePhotoDisplayUrl ? (
                  <img
                    src={detail.profilePhotoDisplayUrl}
                    alt=""
                    className="h-16 w-16 rounded-full border border-[var(--color-border)] object-cover"
                  />
                ) : (
                  <span className="text-sm text-crm-text">{t("employees.notSet")}</span>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 2: Employment ──────────────────────────── */}
          {activeTab === "employment" && (
            <div className="grid h-[380px] grid-cols-2 content-start gap-3.5 overflow-y-auto pr-1">
              <DetailItem label={t("employees.dialog.employment.employeeCode")} value={detail.employeeCode} />
              <DetailItem
                label={t("employees.dialog.employment.title")}
                value={detail.title ? TITLE_LABELS[detail.title] : null}
              />
              <DetailItem label={t("employees.dialog.employment.designation")} value={detail.currentDesignation} />
              <DetailItem label={t("employees.dialog.employment.department")} value={detail.departmentName} />
              <DetailItem
                label={t("employees.dialog.employment.employmentType")}
                value={detail.employmentType ? EMPLOYMENT_TYPE_LABELS[detail.employmentType] : null}
              />
              <DetailItem
                label={t("employees.dialog.employment.employmentStatus")}
                value={detail.employmentStatus ? EMPLOYMENT_STATUS_LABELS[detail.employmentStatus] : null}
              />
              <DetailItem label={t("employees.dialog.employment.dateOfJoined")} value={detail.dateOfJoined} />
              {detail.dateOfExit && (
                <DetailItem label={t("employees.dialog.employment.dateOfExit")} value={detail.dateOfExit} />
              )}
              <DetailItem
                label={t("employees.dialog.employment.clearanceLevel")}
                value={detail.clearanceLevel ? CLEARANCE_LEVEL_LABELS[detail.clearanceLevel] : null}
              />
              <DetailItem label={t("employees.dialog.employment.primaryLocation")} value={detail.primaryLocation} />
              <DetailItem label={t("employees.dialog.employment.baseCountry")} value={detail.baseCountry} />
              <div className="col-span-2">
                <div className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.employment.cv")}
                </div>
                {detail.cvDisplayUrl ? (
                  <a
                    href={detail.cvDisplayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-crm-primary underline"
                  >
                    {detail.cvUrl?.split("/").pop()}
                  </a>
                ) : (
                  <span className="text-sm text-crm-text">{t("employees.notSet")}</span>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 3: Contact ─────────────────────────────── */}
          {activeTab === "contact" && (
            <div className="grid h-[380px] grid-cols-2 content-start gap-3.5 overflow-y-auto pr-1">
              <DetailItem label={t("employees.dialog.contact.email")} value={detail.employeeEmail} />
              <DetailItem label={t("employees.dialog.contact.mobileNo")} value={detail.mobileNo} />
              <DetailItem label={t("employees.dialog.contact.officeNo")} value={detail.officeNo} />
              <div className="col-span-2">
                <div className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.contact.linkedAccount")}
                </div>
                {detail.linkedUser ? (
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crm-primary-tint text-xs font-bold text-crm-primary">
                      {getInitials(detail.linkedUser.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-crm-text">
                        {detail.linkedUser.displayName}
                      </div>
                      <div className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                        @{detail.linkedUser.username}
                      </div>
                    </div>
                    <span
                      className="inline-block shrink-0 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                      style={{ background: "#e6f7ee", color: "#1a9c5f" }}
                    >
                      {t("employees.dialog.contact.linkedBadge")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-text-muted)]">
                    <UserIcon size={16} />
                    {t("employees.dialog.contact.notLinked")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 4: Confidential (EMPLOYEES_VIEW_SENSITIVE only) ── */}
          {activeTab === "confidential" && canViewSensitive && (
            <div className="grid h-[380px] grid-cols-2 content-start gap-3.5 overflow-y-auto pr-1">
              <DetailItem label={t("employees.dialog.confidential.nicPassport")} value={detail.nicPassportNumber} />
              <DetailItem
                label={t("employees.dialog.confidential.baseSalary")}
                value={detail.baseSalary != null ? String(detail.baseSalary) : null}
              />
            </div>
          )}
        </>
      )}

      <div className="mt-2 flex justify-end gap-2.5">
        <Button type="button" onClick={onClose}>
          {t("common.actions.close")}
        </Button>
      </div>
    </Dialog>
  );
}
