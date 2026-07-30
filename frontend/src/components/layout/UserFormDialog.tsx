"use client";

import { useEffect, useState, type FormEvent } from "react";
import { UserStatus } from "@orelia/common";
import type { EmployeeLinkPickerResponse, RbacRoleResponse, UserResponse, UserSummaryResponse } from "@orelia/common";
import { createUser, getUser, getUserRoleIds, updateUser } from "@/lib/api/users";
import { listLinkableEmployees } from "@/lib/api/employees";
import { listRoles } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { EmailField } from "@/components/ui/EmailField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { RoleCardPicker } from "@/components/ui/RoleCardPicker";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { email, minLength, pattern, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

const STATUS_OPTIONS = Object.values(UserStatus).map((status) => ({
  value: status,
  label: status[0].toUpperCase() + status.slice(1),
}));

interface FormState {
  username: string;
  displayName: string;
  loggingEmail: string;
  status: UserStatus;
  // Edit mode only -- a new account's password is always server-generated
  // and unknown to the admin, so this is unconditionally true on create
  // (see UsersService.create()); only meaningful to toggle once the user
  // has their own chosen password.
  mustChangePassword: boolean;
  extras: string;
  roleIds: string[];
  // Story 1.6 -- linked Employee HR record ("" = not linked).
  employeeId: string;
}

function toFormState(user?: UserSummaryResponse): FormState {
  return {
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    loggingEmail: user?.loggingEmail ?? "",
    status: user?.status ?? UserStatus.Active,
    mustChangePassword: true,
    extras: "",
    roleIds: [],
    employeeId: "",
  };
}

interface UserFormDialogProps {
  mode: "create" | "edit";
  user?: UserSummaryResponse;
  onClose: () => void;
  onSaved: (user: UserResponse) => void;
}

export function UserFormDialog({ mode, user, onClose, onSaved }: UserFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(user));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [availableRoles, setAvailableRoles] = useState<RbacRoleResponse[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(mode === "edit");
  // Story 1.6 -- unlinked employees (plus, in edit mode, the one already
  // linked to this user) for the "link to Employee" picker.
  const [linkableEmployees, setLinkableEmployees] = useState<EmployeeLinkPickerResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    listLinkableEmployees(mode === "edit" ? user?.id : undefined)
      .then((employees) => {
        if (!cancelled) setLinkableEmployees(employees);
      })
      .catch(() => {
        // Non-fatal -- the picker just shows no options; the rest of the
        // form works normally.
        if (!cancelled) setLinkableEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, user?.id]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !user) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    Promise.all([getUser(user.id), getUserRoleIds(user.id)])
      .then(([detail, roleIds]) => {
        if (cancelled) return;
        setValues((current) => ({
          ...current,
          displayName: detail.displayName,
          loggingEmail: detail.loggingEmail,
          status: detail.status,
          mustChangePassword: detail.mustChangePassword,
          extras: detail.extras ?? "",
          roleIds,
          employeeId: detail.linkedEmployee?.id ?? "",
        }));
      })
      .catch(() => {
        if (!cancelled) setFormError("Failed to load user details");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, user]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  // Story 1.6 -- selecting an employee pre-fills Display Name and Login
  // Email from the HR record (both stay editable); clearing the selection
  // leaves whatever's typed untouched.
  function handleEmployeeSelected(employeeId: string) {
    const employee = linkableEmployees.find((item) => item.id === employeeId);
    setValues((current) => ({
      ...current,
      employeeId,
      displayName: employee ? employee.fullName : current.displayName,
      loggingEmail: employee?.employeeEmail ? employee.employeeEmail : current.loggingEmail,
    }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (mode === "create") {
      const usernameError = validate(values.username, [
        required(),
        minLength(3),
        pattern(USERNAME_REGEX, "Lowercase letters, numbers, dots, underscores, and hyphens only"),
      ]);
      if (usernameError) nextErrors.username = usernameError;
    }

    const displayNameError = validate(values.displayName, [required(), minLength(2)]);
    if (displayNameError) nextErrors.displayName = displayNameError;

    const emailError = validate(values.loggingEmail, [required(), email()]);
    if (emailError) nextErrors.loggingEmail = emailError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createUser({
              username: values.username.trim(),
              displayName: values.displayName.trim(),
              loggingEmail: values.loggingEmail.trim(),
              status: values.status,
              extras: values.extras.trim() || undefined,
              roleIds: values.roleIds.length > 0 ? values.roleIds : undefined,
              employeeId: values.employeeId || undefined,
            })
          : await updateUser(user!.id, {
              displayName: values.displayName.trim(),
              loggingEmail: values.loggingEmail.trim(),
              status: values.status,
              mustChangePassword: values.mustChangePassword,
              // Always sent as-is (never undefined) in edit mode -- a
              // cleared textbox must actually clear the stored value, not
              // be treated as "field omitted, leave untouched".
              extras: values.extras.trim(),
              roleIds: values.roleIds,
              // Same reasoning: null = explicitly unlinked, never omitted.
              employeeId: values.employeeId || null,
            });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={mode === "create" ? "Add User" : "Edit User"} onClose={onClose} maxWidth="640px">
      {isLoadingDetail ? (
        <div className="dialog-loading">
          <Spinner size={28} />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

          {mode === "create" && (
            <TextField
              label="Username *"
              name="username"
              value={values.username}
              error={errors.username}
              placeholder="e.g. jane.doe"
              onChange={(e) => setField("username", e.target.value.toLowerCase())}
            />
          )}

          {/* Story 1.6 -- link this account to an Employee HR record.
              Options are unlinked employees only (backend also 409s a
              double-link); selecting one pre-fills the two fields below. */}
          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
              {t("users.form.linkedEmployee.label")}
            </label>
            <SearchSelect
              value={values.employeeId}
              onChange={handleEmployeeSelected}
              options={[
                { value: "", label: t("users.form.linkedEmployee.none") },
                ...linkableEmployees.map((employee) => ({
                  value: employee.id,
                  label: employee.fullName,
                  sublabel: employee.employeeEmail ?? undefined,
                })),
              ]}
              placeholder={t("users.form.linkedEmployee.placeholder")}
              searchPlaceholder={t("users.form.linkedEmployee.searchPlaceholder")}
            />
          </div>

          <TextField
            label="Display Name *"
            name="displayName"
            value={values.displayName}
            error={errors.displayName}
            placeholder="e.g. Jane Doe"
            onChange={(e) => setField("displayName", e.target.value)}
          />

          <EmailField
            label="Login Email *"
            name="loggingEmail"
            value={values.loggingEmail}
            error={errors.loggingEmail}
            placeholder="e.g. jane@acme.com"
            onChange={(e) => setField("loggingEmail", e.target.value)}
          />

          {mode === "create" && (
            <p className="mb-[18px] text-[12.5px] text-[var(--color-text-muted)]">
              A temporary password will be generated automatically and emailed to this user --
              they'll be asked to set their own on first sign-in.
            </p>
          )}

          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
              Status *
            </label>
            <CustomSelect
              fullWidth
              label=""
              value={values.status}
              onChange={(val) => setField("status", val as UserStatus)}
              options={STATUS_OPTIONS}
            />
          </div>

          {/* Create mode has no toggle here -- a brand-new account's password
              is always server-generated and unknown to the admin, so this is
              unconditionally true (see UsersService.create()). Only makes
              sense to flip once the user has set their own real password. */}
          {mode === "edit" && (
            <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
              <input
                type="checkbox"
                checked={values.mustChangePassword}
                onChange={(e) => setField("mustChangePassword", e.target.checked)}
              />
              <span>Require password change on next login</span>
            </label>
          )}

          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
              Roles
            </label>
            {isLoadingRoles ? (
              <div className="dialog-loading" style={{ padding: "12px 0" }}>
                <Spinner size={20} />
              </div>
            ) : (
              <RoleCardPicker
                options={availableRoles.map(r => ({ value: r.id, label: r.name, description: r.description }))}
                values={values.roleIds}
                onChange={(roleIds) => setField("roleIds", roleIds)}
              />
            )}
          </div>

          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
              Notes
            </label>
            <textarea
              className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 font-[inherit] text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)] focus:outline-none"
              rows={3}
              value={values.extras}
              onChange={(e) => setField("extras", e.target.value)}
              placeholder="Optional internal notes about this user"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create user" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
