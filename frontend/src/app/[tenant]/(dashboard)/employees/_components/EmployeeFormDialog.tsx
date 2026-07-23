"use client";

import { useRef, useState, type FormEvent } from "react";
import { ClearanceLevel, EmployeeTitle, EmploymentStatus, EmploymentType, Gender } from "@orelia/common";
import type { DepartmentPickerResponse, EmployeeListItemResponse } from "@orelia/common";
import { createEmployee } from "@/lib/api/employees";
import { resolveUploadUrl, uploadEmployeeCv, uploadEmployeePhoto } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PhoneField } from "@/components/ui/PhoneField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { UploadCloudIcon } from "@/components/ui/icons";
import { minLength, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.Male]: t("employees.dialog.genders.male"),
  [Gender.Female]: t("employees.dialog.genders.female"),
  [Gender.Other]: t("employees.dialog.genders.other"),
  [Gender.PreferNotToSay]: t("employees.dialog.genders.prefer_not_to_say"),
};

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  [EmploymentType.FullTime]: t("employees.dialog.employmentTypes.full_time"),
  [EmploymentType.PartTime]: t("employees.dialog.employmentTypes.part_time"),
  [EmploymentType.Contract]: t("employees.dialog.employmentTypes.contract"),
  [EmploymentType.Intern]: t("employees.dialog.employmentTypes.intern"),
  [EmploymentType.Temporary]: t("employees.dialog.employmentTypes.temporary"),
};

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  [EmploymentStatus.Active]: t("employees.status.active"),
  [EmploymentStatus.OnLeave]: t("employees.status.on_leave"),
  [EmploymentStatus.Terminated]: t("employees.status.terminated"),
  [EmploymentStatus.Resigned]: t("employees.status.resigned"),
};

const CLEARANCE_LEVEL_LABELS: Record<ClearanceLevel, string> = {
  [ClearanceLevel.Public]: t("employees.dialog.clearanceLevels.public"),
  [ClearanceLevel.Internal]: t("employees.dialog.clearanceLevels.internal"),
  [ClearanceLevel.Confidential]: t("employees.dialog.clearanceLevels.confidential"),
  [ClearanceLevel.Restricted]: t("employees.dialog.clearanceLevels.restricted"),
};

const TITLE_LABELS: Record<EmployeeTitle, string> = {
  [EmployeeTitle.Mr]: t("employees.titles.mr"),
  [EmployeeTitle.Mrs]: t("employees.titles.mrs"),
  [EmployeeTitle.Ms]: t("employees.titles.ms"),
  [EmployeeTitle.Miss]: t("employees.titles.miss"),
  [EmployeeTitle.Dr]: t("employees.titles.dr"),
};

function withNotSet(options: { value: string; label: string }[]) {
  return [{ value: "", label: t("employees.notSet") }, ...options];
}

const GENDER_OPTIONS = withNotSet(Object.values(Gender).map((value) => ({ value, label: GENDER_LABELS[value] })));
const EMPLOYMENT_TYPE_OPTIONS = withNotSet(
  Object.values(EmploymentType).map((value) => ({ value, label: EMPLOYMENT_TYPE_LABELS[value] })),
);
const EMPLOYMENT_STATUS_OPTIONS = withNotSet(
  Object.values(EmploymentStatus).map((value) => ({ value, label: EMPLOYMENT_STATUS_LABELS[value] })),
);
const TITLE_OPTIONS = withNotSet(Object.values(EmployeeTitle).map((value) => ({ value, label: TITLE_LABELS[value] })));
const CLEARANCE_LEVEL_OPTIONS = withNotSet(
  Object.values(ClearanceLevel).map((value) => ({ value, label: CLEARANCE_LEVEL_LABELS[value] })),
);

type TabId = "personal" | "employment" | "contact" | "confidential";

interface FormState {
  fullName: string;
  dateOfBirth: string;
  gender: Gender | "";
  nationality: string;
  bio: string;
  profilePhotoUrl: string;
  employeeCode: string;
  title: EmployeeTitle | "";
  currentDesignation: string;
  departmentId: string;
  employmentType: EmploymentType | "";
  employmentStatus: EmploymentStatus | "";
  dateOfJoined: string;
  primaryLocation: string;
  baseCountry: string;
  clearanceLevel: ClearanceLevel | "";
  cvUrl: string;
  employeeEmail: string;
  mobileNo: string;
  officeNo: string;
  nicPassportNumber: string;
  baseSalary: string;
}

function emptyFormState(): FormState {
  return {
    fullName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    bio: "",
    profilePhotoUrl: "",
    employeeCode: "",
    title: "",
    currentDesignation: "",
    departmentId: "",
    employmentType: "",
    employmentStatus: "",
    dateOfJoined: "",
    primaryLocation: "",
    baseCountry: "",
    clearanceLevel: "",
    cvUrl: "",
    employeeEmail: "",
    mobileNo: "",
    officeNo: "",
    nicPassportNumber: "",
    baseSalary: "",
  };
}

interface EmployeeFormDialogProps {
  departments: DepartmentPickerResponse[];
  canViewSensitive: boolean;
  onClose: () => void;
  onSaved: (employee: EmployeeListItemResponse) => void;
}

export function EmployeeFormDialog({ departments, canViewSensitive, onClose, onSaved }: EmployeeFormDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [values, setValues] = useState<FormState>(emptyFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError(null);
    setIsUploadingPhoto(true);
    try {
      const { url } = await uploadEmployeePhoto(file);
      setField("profilePhotoUrl", url);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("employees.dialog.errors.photoUploadFailed"));
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleCvChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError(null);
    setIsUploadingCv(true);
    try {
      const { url } = await uploadEmployeeCv(file);
      setField("cvUrl", url);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("employees.dialog.errors.cvUploadFailed"));
    } finally {
      setIsUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.fullName, [required(), minLength(1)]);
    if (nameError) nextErrors.fullName = nameError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setActiveTab("personal");
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      const employee = await createEmployee({
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        nationality: values.nationality.trim() || undefined,
        bio: values.bio.trim() || undefined,
        profilePhotoUrl: values.profilePhotoUrl || undefined,
        employeeCode: values.employeeCode.trim() || undefined,
        title: values.title || undefined,
        currentDesignation: values.currentDesignation.trim() || undefined,
        departmentId: values.departmentId || undefined,
        employmentType: values.employmentType || undefined,
        employmentStatus: values.employmentStatus || undefined,
        dateOfJoined: values.dateOfJoined || undefined,
        primaryLocation: values.primaryLocation.trim() || undefined,
        baseCountry: values.baseCountry.trim() || undefined,
        clearanceLevel: values.clearanceLevel || undefined,
        cvUrl: values.cvUrl || undefined,
        employeeEmail: values.employeeEmail.trim() || undefined,
        mobileNo: values.mobileNo || undefined,
        officeNo: values.officeNo.trim() || undefined,
        // Confidential fields are only ever sent when the Confidential tab is
        // actually visible -- the backend independently strips them anyway
        // for a caller without EMPLOYEES_VIEW_SENSITIVE, this just avoids
        // sending fields the user never had a chance to see or set.
        nicPassportNumber: canViewSensitive ? values.nicPassportNumber.trim() || undefined : undefined,
        baseSalary: canViewSensitive && values.baseSalary.trim() ? Number(values.baseSalary) : undefined,
      });
      onSaved(employee);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("employees.dialog.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const departmentOptions = withNotSet(departments.map((d) => ({ value: d.id, label: d.name })));

  return (
    <Dialog open title={t("employees.dialog.addTitle")} onClose={onClose} maxWidth="720px">
      <form onSubmit={handleSubmit}>
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

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        {/* ── Tab 1: Personal ────────────────────────────── */}
        {activeTab === "personal" && (
          <div>
            <TextField
              label={t("employees.dialog.personal.fullName")}
              name="fullName"
              value={values.fullName}
              error={errors.fullName}
              placeholder={t("employees.dialog.personal.fullNamePlaceholder")}
              onChange={(e) => setField("fullName", e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3.5">
              <TextField
                label={t("employees.dialog.personal.dateOfBirth")}
                name="dateOfBirth"
                type="date"
                value={values.dateOfBirth}
                onChange={(e) => setField("dateOfBirth", e.target.value)}
              />
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.personal.gender")}
                </label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.gender}
                  onChange={(val) => setField("gender", val as Gender | "")}
                  options={GENDER_OPTIONS}
                />
              </div>
            </div>

            <TextField
              label={t("employees.dialog.personal.nationality")}
              name="nationality"
              value={values.nationality}
              onChange={(e) => setField("nationality", e.target.value)}
            />

            <div className="mb-[18px]">
              <label htmlFor="bio" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                {t("employees.dialog.personal.bio")}
              </label>
              <textarea
                id="bio"
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 font-[inherit] text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)] focus:outline-none"
                rows={3}
                value={values.bio}
                placeholder={t("employees.dialog.personal.bioPlaceholder")}
                onChange={(e) => setField("bio", e.target.value)}
              />
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                {t("employees.dialog.personal.photo")}
              </label>
              <div className="flex items-center gap-3">
                {values.profilePhotoUrl && (
                  <img
                    src={resolveUploadUrl(values.profilePhotoUrl)}
                    alt=""
                    className="h-12 w-12 rounded-full border border-[var(--color-border)] object-cover"
                  />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => photoInputRef.current?.click()}
                  isLoading={isUploadingPhoto}
                >
                  <UploadCloudIcon size={14} />{" "}
                  {values.profilePhotoUrl
                    ? t("employees.dialog.personal.replacePhoto")
                    : t("employees.dialog.personal.uploadPhoto")}
                </Button>
                {values.profilePhotoUrl && (
                  <Button type="button" variant="secondary" onClick={() => setField("profilePhotoUrl", "")}>
                    {t("employees.dialog.personal.removePhoto")}
                  </Button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Employment ──────────────────────────── */}
        {activeTab === "employment" && (
          <div>
            <div className="grid grid-cols-2 gap-3.5">
              <TextField
                label={t("employees.dialog.employment.employeeCode")}
                name="employeeCode"
                value={values.employeeCode}
                onChange={(e) => setField("employeeCode", e.target.value)}
              />
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.employment.title")}
                </label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.title}
                  onChange={(val) => setField("title", val as EmployeeTitle | "")}
                  options={TITLE_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <TextField
                label={t("employees.dialog.employment.designation")}
                name="currentDesignation"
                value={values.currentDesignation}
                onChange={(e) => setField("currentDesignation", e.target.value)}
              />
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.employment.department")}
                </label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.departmentId}
                  onChange={(val) => setField("departmentId", val)}
                  options={departmentOptions}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.employment.employmentType")}
                </label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.employmentType}
                  onChange={(val) => setField("employmentType", val as EmploymentType | "")}
                  options={EMPLOYMENT_TYPE_OPTIONS}
                />
              </div>
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.employment.employmentStatus")}
                </label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.employmentStatus}
                  onChange={(val) => setField("employmentStatus", val as EmploymentStatus | "")}
                  options={EMPLOYMENT_STATUS_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <TextField
                label={t("employees.dialog.employment.dateOfJoined")}
                name="dateOfJoined"
                type="date"
                value={values.dateOfJoined}
                onChange={(e) => setField("dateOfJoined", e.target.value)}
              />
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("employees.dialog.employment.clearanceLevel")}
                </label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.clearanceLevel}
                  onChange={(val) => setField("clearanceLevel", val as ClearanceLevel | "")}
                  options={CLEARANCE_LEVEL_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <TextField
                label={t("employees.dialog.employment.primaryLocation")}
                name="primaryLocation"
                value={values.primaryLocation}
                onChange={(e) => setField("primaryLocation", e.target.value)}
              />
              <TextField
                label={t("employees.dialog.employment.baseCountry")}
                name="baseCountry"
                value={values.baseCountry}
                onChange={(e) => setField("baseCountry", e.target.value)}
              />
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                {t("employees.dialog.employment.cv")}
              </label>
              <div className="flex items-center gap-3">
                {values.cvUrl && (
                  <a
                    href={resolveUploadUrl(values.cvUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-crm-primary underline"
                  >
                    {values.cvUrl.split("/").pop()}
                  </a>
                )}
                <Button type="button" variant="secondary" onClick={() => cvInputRef.current?.click()} isLoading={isUploadingCv}>
                  <UploadCloudIcon size={14} />{" "}
                  {values.cvUrl ? t("employees.dialog.employment.replaceCv") : t("employees.dialog.employment.uploadCv")}
                </Button>
                {values.cvUrl && (
                  <Button type="button" variant="secondary" onClick={() => setField("cvUrl", "")}>
                    {t("employees.dialog.employment.removeCv")}
                  </Button>
                )}
                <input
                  ref={cvInputRef}
                  type="file"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  hidden
                  onChange={handleCvChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Contact ─────────────────────────────── */}
        {activeTab === "contact" && (
          <div>
            <TextField
              label={t("employees.dialog.contact.email")}
              name="employeeEmail"
              type="email"
              value={values.employeeEmail}
              onChange={(e) => setField("employeeEmail", e.target.value)}
            />
            <PhoneField
              label={t("employees.dialog.contact.mobileNo")}
              name="mobileNo"
              value={values.mobileNo}
              onChange={(val) => setField("mobileNo", val)}
            />
            <TextField
              label={t("employees.dialog.contact.officeNo")}
              name="officeNo"
              value={values.officeNo}
              onChange={(e) => setField("officeNo", e.target.value)}
            />
          </div>
        )}

        {/* ── Tab 4: Confidential (EMPLOYEES_VIEW_SENSITIVE only) ── */}
        {activeTab === "confidential" && canViewSensitive && (
          <div>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">{t("employees.dialog.confidential.notice")}</p>
            <TextField
              label={t("employees.dialog.confidential.nicPassport")}
              name="nicPassportNumber"
              value={values.nicPassportNumber}
              onChange={(e) => setField("nicPassportNumber", e.target.value)}
            />
            <TextField
              label={t("employees.dialog.confidential.baseSalary")}
              name="baseSalary"
              type="number"
              min="0"
              step="0.01"
              value={values.baseSalary}
              onChange={(e) => setField("baseSalary", e.target.value)}
            />
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {t("employees.dialog.saveButton")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
