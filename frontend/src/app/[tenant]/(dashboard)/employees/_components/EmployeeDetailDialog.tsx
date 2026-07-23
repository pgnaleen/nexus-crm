"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EmployeeDetailResponse } from "@orelia/common";
import { getEmployee } from "@/lib/api/employees";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
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

  return (
    <Dialog open title={t("employees.dialog.viewTitle")} onClose={onClose} maxWidth="720px">
      <div className="dialog-tabs">
        <button
          type="button"
          className={`dialog-tab${activeTab === "personal" ? " dialog-tab-active" : ""}`}
          onClick={() => setActiveTab("personal")}
        >
          {t("employees.dialog.tabs.personal")}
        </button>
        <button
          type="button"
          className={`dialog-tab${activeTab === "employment" ? " dialog-tab-active" : ""}`}
          onClick={() => setActiveTab("employment")}
        >
          {t("employees.dialog.tabs.employment")}
        </button>
        <button
          type="button"
          className={`dialog-tab${activeTab === "contact" ? " dialog-tab-active" : ""}`}
          onClick={() => setActiveTab("contact")}
        >
          {t("employees.dialog.tabs.contact")}
        </button>
        {canViewSensitive && (
          <button
            type="button"
            className={`dialog-tab${activeTab === "confidential" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("confidential")}
          >
            {t("employees.dialog.tabs.confidential")}
          </button>
        )}
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
                {detail.profilePhotoUrl ? (
                  <img
                    src={resolveUploadUrl(detail.profilePhotoUrl)}
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
                {detail.cvUrl ? (
                  <a
                    href={resolveUploadUrl(detail.cvUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-crm-primary underline"
                  >
                    {detail.cvUrl.split("/").pop()}
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
              <DetailItem
                label={t("employees.dialog.contact.linkedAccount")}
                value={
                  detail.linkedUser
                    ? `${detail.linkedUser.displayName} (${detail.linkedUser.username})`
                    : t("employees.dialog.contact.notLinked")
                }
              />
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
