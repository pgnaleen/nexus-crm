import type { ReactNode } from "react";
import type { EmployeeDetailResponse } from "@orelia/common";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { t } from "@/lib/i18n";
import {
  CLEARANCE_LEVEL_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  TITLE_LABELS,
} from "../../employees/_components/employeeLabels";

// Story 1.11 -- the caller's own HR record on My Profile: Personal,
// Employment, Contact -- read-only (HR-controlled; no edit affordances) and
// deliberately NO Confidential section, even though it's the viewer's own
// data (EMPLOYEES_VIEW_SENSITIVE gates that, not "is this me"; the backend
// nulls those fields on this endpoint regardless). Server component -- pure
// display, nothing interactive.

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">{label}</div>
      <div className="text-sm font-medium text-crm-text">{value || t("employees.notSet")}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-2 m-0 mt-2 mb-1 border-b border-[var(--color-border)] pb-1.5 text-[13px] font-bold tracking-[0.02em] text-crm-text uppercase">
      {children}
    </h3>
  );
}

export function MyEmployeeRecord({ record }: { record: EmployeeDetailResponse }) {
  return (
    <div>
      <p className="m-0 mb-4 text-[12.5px] text-[var(--color-text-muted)]">
        {t("profile.employeeRecord.hint")}
      </p>

      {record.profilePhotoUrl && (
        <img
          src={resolveUploadUrl(record.profilePhotoUrl)}
          alt=""
          className="mb-4 h-16 w-16 rounded-full border border-[var(--color-border)] object-cover"
        />
      )}

      <div className="grid grid-cols-2 gap-x-5 gap-y-0">
        <SectionHeading>{t("employees.dialog.tabs.personal")}</SectionHeading>
        <Item label={t("employees.dialog.personal.fullName").replace(" *", "")} value={record.fullName} />
        <Item label={t("employees.dialog.personal.dateOfBirth")} value={record.dateOfBirth} />
        <Item
          label={t("employees.dialog.personal.gender")}
          value={record.gender ? GENDER_LABELS[record.gender] : null}
        />
        <Item label={t("employees.dialog.personal.nationality")} value={record.nationality} />
        {record.bio && (
          <div className="col-span-2">
            <Item label={t("employees.dialog.personal.bio")} value={record.bio} />
          </div>
        )}

        <SectionHeading>{t("employees.dialog.tabs.employment")}</SectionHeading>
        <Item label={t("employees.dialog.employment.employeeCode")} value={record.employeeCode} />
        <Item
          label={t("employees.dialog.employment.title")}
          value={record.title ? TITLE_LABELS[record.title] : null}
        />
        <Item label={t("employees.dialog.employment.designation")} value={record.currentDesignation} />
        <Item label={t("employees.dialog.employment.department")} value={record.departmentName} />
        <Item
          label={t("employees.dialog.employment.employmentType")}
          value={record.employmentType ? EMPLOYMENT_TYPE_LABELS[record.employmentType] : null}
        />
        <Item
          label={t("employees.dialog.employment.employmentStatus")}
          value={record.employmentStatus ? EMPLOYMENT_STATUS_LABELS[record.employmentStatus] : null}
        />
        <Item label={t("employees.dialog.employment.dateOfJoined")} value={record.dateOfJoined} />
        <Item
          label={t("employees.dialog.employment.clearanceLevel")}
          value={record.clearanceLevel ? CLEARANCE_LEVEL_LABELS[record.clearanceLevel] : null}
        />
        <Item label={t("employees.dialog.employment.primaryLocation")} value={record.primaryLocation} />
        <Item label={t("employees.dialog.employment.baseCountry")} value={record.baseCountry} />

        <SectionHeading>{t("employees.dialog.tabs.contact")}</SectionHeading>
        <Item label={t("employees.dialog.contact.email")} value={record.employeeEmail} />
        <Item label={t("employees.dialog.contact.mobileNo")} value={record.mobileNo} />
        <Item label={t("employees.dialog.contact.officeNo")} value={record.officeNo} />
      </div>
    </div>
  );
}
