import { ClearanceLevel, EmployeeTitle, EmploymentStatus, EmploymentType, Gender } from "@orelia/common";
import { t } from "@/lib/i18n";

// Shared between EmployeeFormDialog (create) and EmployeeDetailDialog (view)
// -- one place to translate an enum value, so the two never drift.
export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.Male]: t("employees.dialog.genders.male"),
  [Gender.Female]: t("employees.dialog.genders.female"),
  [Gender.Other]: t("employees.dialog.genders.other"),
  [Gender.PreferNotToSay]: t("employees.dialog.genders.prefer_not_to_say"),
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  [EmploymentType.FullTime]: t("employees.dialog.employmentTypes.full_time"),
  [EmploymentType.PartTime]: t("employees.dialog.employmentTypes.part_time"),
  [EmploymentType.Contract]: t("employees.dialog.employmentTypes.contract"),
  [EmploymentType.Intern]: t("employees.dialog.employmentTypes.intern"),
  [EmploymentType.Temporary]: t("employees.dialog.employmentTypes.temporary"),
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  [EmploymentStatus.Active]: t("employees.status.active"),
  [EmploymentStatus.OnLeave]: t("employees.status.on_leave"),
  [EmploymentStatus.Terminated]: t("employees.status.terminated"),
  [EmploymentStatus.Resigned]: t("employees.status.resigned"),
};

export const CLEARANCE_LEVEL_LABELS: Record<ClearanceLevel, string> = {
  [ClearanceLevel.Public]: t("employees.dialog.clearanceLevels.public"),
  [ClearanceLevel.Internal]: t("employees.dialog.clearanceLevels.internal"),
  [ClearanceLevel.Confidential]: t("employees.dialog.clearanceLevels.confidential"),
  [ClearanceLevel.Restricted]: t("employees.dialog.clearanceLevels.restricted"),
};

export const TITLE_LABELS: Record<EmployeeTitle, string> = {
  [EmployeeTitle.Mr]: t("employees.titles.mr"),
  [EmployeeTitle.Mrs]: t("employees.titles.mrs"),
  [EmployeeTitle.Ms]: t("employees.titles.ms"),
  [EmployeeTitle.Miss]: t("employees.titles.miss"),
  [EmployeeTitle.Dr]: t("employees.titles.dr"),
};
