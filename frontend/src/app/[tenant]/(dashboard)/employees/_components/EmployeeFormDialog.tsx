"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClearanceLevel, EmployeeTitle, EmploymentStatus, EmploymentType, Gender, UserStatus } from "@orelia/common";
import type {
  DepartmentPickerResponse,
  EmployeeDetailResponse,
  EmployeeListItemResponse,
  RbacRoleResponse,
  UpdateEmployeeRequest,
} from "@orelia/common";
import { createEmployee, updateEmployee } from "@/lib/api/employees";
import { createUser } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { uploadEmployeeCv, uploadEmployeePhoto } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { EmailField } from "@/components/ui/EmailField";
import { PhoneField } from "@/components/ui/PhoneField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { RoleCardPicker } from "@/components/ui/RoleCardPicker";
import { CheckCircleIcon, UploadCloudIcon } from "@/components/ui/icons";
import { email, minLength, pattern, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";
import {
  CLEARANCE_LEVEL_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  TITLE_LABELS,
} from "./employeeLabels";

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

type TabId = "personal" | "employment" | "contact" | "confidential" | "account";

// Mirrors UserFormDialog's own USERNAME_REGEX -- kept as a separate local
// copy rather than importing from that dialog, since it's not exported and
// this is the only other place that needs it.
const USERNAME_REGEX = /^[a-z0-9._-]+$/;

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

// Story 1.4 -- edit mode pre-fill. Detail nulls map to "" (the form's own
// empty representation); baseSalary may arrive as a numeric string from the
// API (Postgres numeric), String() covers both.
function formStateFromDetail(detail: EmployeeDetailResponse): FormState {
  return {
    fullName: detail.fullName,
    dateOfBirth: detail.dateOfBirth ?? "",
    gender: detail.gender ?? "",
    nationality: detail.nationality ?? "",
    bio: detail.bio ?? "",
    profilePhotoUrl: detail.profilePhotoUrl ?? "",
    employeeCode: detail.employeeCode ?? "",
    title: detail.title ?? "",
    currentDesignation: detail.currentDesignation ?? "",
    departmentId: detail.departmentId ?? "",
    employmentType: detail.employmentType ?? "",
    employmentStatus: detail.employmentStatus ?? "",
    dateOfJoined: detail.dateOfJoined ?? "",
    primaryLocation: detail.primaryLocation ?? "",
    baseCountry: detail.baseCountry ?? "",
    clearanceLevel: detail.clearanceLevel ?? "",
    cvUrl: detail.cvUrl ?? "",
    employeeEmail: detail.employeeEmail ?? "",
    mobileNo: detail.mobileNo ?? "",
    officeNo: detail.officeNo ?? "",
    nicPassportNumber: detail.nicPassportNumber ?? "",
    baseSalary: detail.baseSalary != null ? String(detail.baseSalary) : "",
  };
}

interface EmployeeFormDialogProps {
  departments: DepartmentPickerResponse[];
  canViewSensitive: boolean;
  // Gates the "Also create a login account" tab. Create mode only -- caller
  // (EmployeesWidget) derives this from PERMISSIONS.USERS_CREATE, since
  // creating a login is a distinct capability from creating an employee.
  canCreateLogin?: boolean;
  onClose: () => void;
  onSaved: (employee: EmployeeListItemResponse) => void;
  // Story 1.4 -- both present = edit mode: the form pre-fills from
  // initialDetail and PATCHes instead of POSTing.
  initialDetail?: EmployeeDetailResponse;
  onUpdated?: (employee: EmployeeDetailResponse) => void;
}

// Suggests a starting point for the login username from whatever's already
// typed -- the email's local part if there is one (most likely to already be
// unique org-wide), otherwise a dotted version of the full name. Always
// editable afterwards; this only fires once, when the checkbox is first
// switched on.
function suggestUsername(employeeEmail: string, fullName: string): string {
  const fromEmail = employeeEmail.trim().split("@")[0] ?? "";
  if (fromEmail) return fromEmail.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return fullName.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "");
}

// Excludes visually-ambiguous characters (0/O, 1/l/I) since this password is
// meant to be read off-screen and typed once at first login, not just
// copy-pasted.
const TEMP_PASSWORD_CHARS = {
  lower: "abcdefghijkmnpqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digit: "23456789",
  special: "!@#$%^&*-_",
};

function secureRandomFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / (0xffffffff + 1);
}

// Generates a password satisfying PASSWORD_STRENGTH_REGEX (lib/validation.ts)
// by construction -- one guaranteed char from each required class, then
// random fill, then shuffled so the required chars aren't always first.
function generateTempPassword(): string {
  const pools = Object.values(TEMP_PASSWORD_CHARS);
  const all = pools.join("");
  const pick = (chars: string) => chars[Math.floor(secureRandomFloat() * chars.length)];
  const chars = [...pools.map(pick), ...Array.from({ length: 10 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandomFloat() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

type LoginResult =
  | { status: "success"; username: string; password: string }
  | { status: "error"; message: string };

export function EmployeeFormDialog({
  departments,
  canViewSensitive,
  canCreateLogin = false,
  onClose,
  onSaved,
  initialDetail,
  onUpdated,
}: EmployeeFormDialogProps) {
  const isEditMode = Boolean(initialDetail);
  const showAccountTab = !isEditMode && canCreateLogin;
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [values, setValues] = useState<FormState>(() =>
    initialDetail ? formStateFromDetail(initialDetail) : emptyFormState(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // "Also create a login" -- create mode only, gated by showAccountTab.
  const [createLogin, setCreateLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginRoleIds, setLoginRoleIds] = useState<string[]>([]);
  const [loginErrors, setLoginErrors] = useState<{ username?: string; email?: string; roles?: string }>({});
  const [availableRoles, setAvailableRoles] = useState<RbacRoleResponse[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  // Non-null once the employee save has gone through and (if requested) the
  // login attempt has resolved either way -- swaps the dialog body from the
  // form to a result screen. The employee is captured here specifically so
  // "Done" can still call onSaved even if the login half failed: the
  // employee record is real and must show up in the list either way.
  const [postSaveState, setPostSaveState] = useState<{
    employee: EmployeeListItemResponse;
    login: LoginResult;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  useEffect(() => {
    if (!showAccountTab) return;
    let cancelled = false;
    setIsLoadingRoles(true);
    listRoles()
      .then((roles) => {
        if (!cancelled) setAvailableRoles(roles);
      })
      .catch(() => {
        if (!cancelled) setAvailableRoles([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRoles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAccountTab]);

  function handleToggleCreateLogin(checked: boolean) {
    setCreateLogin(checked);
    if (checked && !loginUsername) {
      setLoginUsername(suggestUsername(values.employeeEmail, values.fullName));
    }
  }
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  // values.profilePhotoUrl/cvUrl are the stable S3 keys that actually get
  // saved -- both are private objects, so there's no permanent URL to render
  // directly. These hold whichever signed URL is current for preview: the
  // freshly-uploaded one this session, or (on edit) the one the server
  // already resolved for the existing file. Never themselves persisted.
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(
    initialDetail?.profilePhotoDisplayUrl ?? null,
  );
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(initialDetail?.cvDisplayUrl ?? null);
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
      const { key, previewUrl } = await uploadEmployeePhoto(file, values.fullName);
      setField("profilePhotoUrl", key);
      setPhotoPreviewUrl(previewUrl);
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
      const { key, previewUrl } = await uploadEmployeeCv(file, values.fullName);
      setField("cvUrl", key);
      setCvPreviewUrl(previewUrl);
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

    const nextLoginErrors: { username?: string; email?: string; roles?: string } = {};
    if (createLogin) {
      const usernameError = validate(loginUsername, [
        required(),
        minLength(3),
        pattern(USERNAME_REGEX, "Lowercase letters, numbers, dots, underscores, and hyphens only"),
      ]);
      if (usernameError) nextLoginErrors.username = usernameError;

      // The login's email is the employee's own Contact-tab email -- there's
      // no separate field for it, so a missing/invalid one is reported here,
      // on the Account tab, even though the value itself lives on Contact.
      const loginEmailError = validate(values.employeeEmail, [required(), email()]);
      if (loginEmailError) nextLoginErrors.email = loginEmailError;

      if (loginRoleIds.length === 0) {
        nextLoginErrors.roles = t("employees.dialog.account.errors.roleRequired");
      }
    }
    setLoginErrors(nextLoginErrors);
    if (Object.keys(nextLoginErrors).length > 0) {
      setActiveTab("account");
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
      if (isEditMode && initialDetail) {
        // Tri-state contract: every rendered field is sent, "" -> null so
        // clearing a previously-set optional field genuinely clears it
        // (unlike create's `|| undefined`). Confidential keys are omitted
        // entirely without EMPLOYEES_VIEW_SENSITIVE -- the backend deletes
        // them again server-side regardless.
        const payload: UpdateEmployeeRequest = {
          fullName: values.fullName.trim(),
          dateOfBirth: values.dateOfBirth || null,
          gender: values.gender || null,
          nationality: values.nationality.trim() || null,
          bio: values.bio.trim() || null,
          profilePhotoUrl: values.profilePhotoUrl || null,
          employeeCode: values.employeeCode.trim() || null,
          title: values.title || null,
          currentDesignation: values.currentDesignation.trim() || null,
          departmentId: values.departmentId || null,
          employmentType: values.employmentType || null,
          employmentStatus: values.employmentStatus || null,
          dateOfJoined: values.dateOfJoined || null,
          primaryLocation: values.primaryLocation.trim() || null,
          baseCountry: values.baseCountry.trim() || null,
          clearanceLevel: values.clearanceLevel || null,
          cvUrl: values.cvUrl || null,
          employeeEmail: values.employeeEmail.trim() || null,
          mobileNo: values.mobileNo || null,
          officeNo: values.officeNo || null,
        };
        if (canViewSensitive) {
          payload.nicPassportNumber = values.nicPassportNumber.trim() || null;
          payload.baseSalary = values.baseSalary.trim() ? Number(values.baseSalary) : null;
        }
        const updated = await updateEmployee(initialDetail.id, payload);
        onUpdated?.(updated);
        onClose();
        return;
      }

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
        officeNo: values.officeNo || undefined,
        // Confidential fields are only ever sent when the Confidential tab is
        // actually visible -- the backend independently strips them anyway
        // for a caller without EMPLOYEES_VIEW_SENSITIVE, this just avoids
        // sending fields the user never had a chance to see or set.
        nicPassportNumber: canViewSensitive ? values.nicPassportNumber.trim() || undefined : undefined,
        baseSalary: canViewSensitive && values.baseSalary.trim() ? Number(values.baseSalary) : undefined,
      });

      if (!createLogin) {
        onSaved(employee);
        onClose();
        return;
      }

      // The employee row now exists for real, regardless of what happens
      // next -- a failure here gets its own try/catch (never the outer
      // catch/formError below) so it can't be mistaken for "nothing saved".
      // The dialog stays open on a dedicated result screen either way; the
      // employee is only handed to onSaved once the admin acknowledges it
      // via "Done", see the postSaveState render branch.
      try {
        const password = generateTempPassword();
        await createUser({
          username: loginUsername.trim(),
          displayName: values.fullName.trim(),
          loggingEmail: values.employeeEmail.trim(),
          password,
          status: UserStatus.Active,
          mustChangePassword: true,
          roleIds: loginRoleIds,
          employeeId: employee.id,
        });
        setPostSaveState({ employee, login: { status: "success", username: loginUsername.trim(), password } });
      } catch (err) {
        setPostSaveState({
          employee,
          login: {
            status: "error",
            message: err instanceof ApiError ? err.message : t("employees.dialog.account.resultErrorGeneric"),
          },
        });
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("employees.dialog.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const departmentOptions = withNotSet(departments.map((d) => ({ value: d.id, label: d.name })));

  // Once set, the dialog stays open on a result screen instead of the form
  // (see the postSaveState branch below) -- every way to close the dialog
  // from there (X button, overlay click, Escape -- Dialog funnels all three
  // through this one onClose prop) must still hand the employee to onSaved,
  // exactly like clicking "Done" does, or the new row silently never reaches
  // the list until a manual refresh.
  const handleDialogClose = postSaveState
    ? () => {
        onSaved(postSaveState.employee);
        onClose();
      }
    : onClose;

  return (
    <Dialog
      open
      title={
        postSaveState
          ? t("employees.dialog.account.resultDialogTitle")
          : isEditMode
            ? t("employees.dialog.editTitle")
            : t("employees.dialog.addTitle")
      }
      onClose={handleDialogClose}
      maxWidth="720px"
    >
      {postSaveState ? (
        <div className="px-1 py-1">
          {(() => {
            const { employee, login } = postSaveState;
            return login.status === "success" ? (
              <>
                <div className="mb-3 flex items-center gap-2 text-crm-primary">
                  <CheckCircleIcon size={20} />
                  <h3 className="text-[15px] font-semibold text-crm-text">
                    {t("employees.dialog.account.resultSuccessTitle")}
                  </h3>
                </div>
                <p className="mb-4 text-[13px] text-[var(--color-text-muted)]">
                  {t("employees.dialog.account.resultSuccessMessage", { name: employee.fullName })}
                </p>
                <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[#f8fafc] p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                      {t("employees.dialog.account.usernameLabel")}
                    </span>
                    <span className="font-mono text-[13px] text-crm-text">{login.username}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                      {t("employees.dialog.account.passwordLabel")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] text-crm-text">{login.password}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(login.password);
                          setPasswordCopied(true);
                        }}
                      >
                        {passwordCopied
                          ? t("employees.dialog.account.copied")
                          : t("employees.dialog.account.copyPassword")}
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {t("employees.dialog.account.passwordNotice")}
                </p>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-[15px] font-semibold text-crm-text">
                  {t("employees.dialog.account.resultErrorTitle")}
                </h3>
                <p className="mb-2 text-[13px] text-[var(--color-danger)]">
                  {t("employees.dialog.account.resultErrorMessage", {
                    name: employee.fullName,
                    error: login.message,
                  })}
                </p>
                <p className="mb-4 text-[13px] text-[var(--color-text-muted)]">
                  {t("employees.dialog.account.resultErrorHint")}
                </p>
              </>
            );
          })()}
          <div className="mt-2 flex justify-end">
            <Button type="button" onClick={handleDialogClose}>
              {t("employees.dialog.account.doneButton")}
            </Button>
          </div>
        </div>
      ) : (
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
          {showAccountTab && (
            <button
              type="button"
              className={`dialog-tab${activeTab === "account" ? " dialog-tab-active" : ""}`}
              onClick={() => setActiveTab("account")}
            >
              {t("employees.dialog.tabs.account")}
            </button>
          )}
        </div>

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        {/* ── Tab 1: Personal ────────────────────────────── */}
        {activeTab === "personal" && (
          <div className="h-[480px] overflow-y-auto pr-1">
            <TextField
              label={t("employees.dialog.personal.fullName")}
              name="fullName"
              value={values.fullName}
              error={errors.fullName}
              placeholder={t("employees.dialog.personal.fullNamePlaceholder")}
              onChange={(e) => setField("fullName", e.target.value)}
            />

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 font-[inherit] text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)] focus:outline-none"
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
                {photoPreviewUrl && (
                  <img
                    src={photoPreviewUrl}
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setField("profilePhotoUrl", "");
                      setPhotoPreviewUrl(null);
                    }}
                  >
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
          <div className="h-[480px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <TextField
                label={t("employees.dialog.employment.primaryLocation")}
                name="primaryLocation"
                value={values.primaryLocation}
                onChange={(e) => setField("primaryLocation", e.target.value)}
              />
              <CountrySelect
                label={t("employees.dialog.employment.baseCountry")}
                value={values.baseCountry}
                onChange={(val) => setField("baseCountry", val)}
              />
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                {t("employees.dialog.employment.cv")}
              </label>
              <div className="flex items-center gap-3">
                {cvPreviewUrl && (
                  <a
                    href={cvPreviewUrl}
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setField("cvUrl", "");
                      setCvPreviewUrl(null);
                    }}
                  >
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
          <div className="h-[480px] overflow-y-auto pr-1">
            <EmailField
              label={t("employees.dialog.contact.email")}
              name="employeeEmail"
              value={values.employeeEmail}
              error={errors.employeeEmail}
              onChange={(e) => setField("employeeEmail", e.target.value)}
            />
            <PhoneField
              label={t("employees.dialog.contact.mobileNo")}
              name="mobileNo"
              value={values.mobileNo}
              onChange={(val) => setField("mobileNo", val)}
              defaultCountry="LK"
            />
            <PhoneField
              label={t("employees.dialog.contact.officeNo")}
              name="officeNo"
              value={values.officeNo}
              onChange={(val) => setField("officeNo", val)}
              defaultCountry="LK"
            />
          </div>
        )}

        {/* ── Tab 4: Confidential (EMPLOYEES_VIEW_SENSITIVE only) ── */}
        {activeTab === "confidential" && canViewSensitive && (
          <div className="h-[480px] overflow-y-auto pr-1">
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

        {/* ── Tab 5: Account (create mode + USERS_CREATE only) ── */}
        {activeTab === "account" && showAccountTab && (
          <div className="h-[480px] overflow-y-auto pr-1">
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-[13.5px] text-crm-text">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={createLogin}
                onChange={(e) => handleToggleCreateLogin(e.target.checked)}
              />
              <span>
                <span className="block font-semibold">{t("employees.dialog.account.checkboxLabel")}</span>
                <span className="block text-[12.5px] text-[var(--color-text-muted)]">
                  {t("employees.dialog.account.checkboxHint")}
                </span>
              </span>
            </label>

            {createLogin && (
              <>
                <TextField
                  label={t("employees.dialog.account.username")}
                  name="loginUsername"
                  value={loginUsername}
                  error={loginErrors.username}
                  placeholder={t("employees.dialog.account.usernamePlaceholder")}
                  onChange={(e) => setLoginUsername(e.target.value.toLowerCase())}
                />

                <p className="mb-1.5 text-[12px] text-[var(--color-text-muted)]">
                  {t("employees.dialog.account.emailSourceHint")}
                </p>
                {loginErrors.email && (
                  <p className="mb-4 text-[12.5px] text-[var(--color-danger)]">{loginErrors.email}</p>
                )}

                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    {t("employees.dialog.account.roles")}
                  </label>
                  {isLoadingRoles ? (
                    <div className="dialog-loading" style={{ padding: "12px 0" }}>
                      <Spinner size={20} />
                    </div>
                  ) : (
                    <RoleCardPicker
                      options={availableRoles.map((r) => ({ value: r.id, label: r.name, description: r.description ?? undefined }))}
                      values={loginRoleIds}
                      onChange={setLoginRoleIds}
                    />
                  )}
                  {loginErrors.roles && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{loginErrors.roles}</p>
                  )}
                </div>

                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {t("employees.dialog.account.passwordNotice")}
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEditMode ? t("employees.dialog.updateButton") : t("employees.dialog.saveButton")}
          </Button>
        </div>
      </form>
      )}
    </Dialog>
  );
}
