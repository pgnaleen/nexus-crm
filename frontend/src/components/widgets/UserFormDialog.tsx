"use client";

import { useEffect, useState, type FormEvent } from "react";
import { UserStatus } from "@orelia/common";
import type { RbacRoleResponse, UserResponse, UserSummaryResponse } from "@orelia/common";
import { createUser, updateUser } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { EmailField } from "@/components/ui/EmailField";
import { PasswordField } from "@/components/ui/PasswordField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { email, minLength, pattern, required, validate } from "@/lib/validation";

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

const STATUS_OPTIONS = Object.values(UserStatus).map((status) => ({
  value: status,
  label: status[0].toUpperCase() + status.slice(1),
}));

interface FormState {
  username: string;
  displayName: string;
  loggingEmail: string;
  password: string;
  confirmPassword: string;
  status: UserStatus;
  mustChangePassword: boolean;
  extras: string;
  roleIds: string[];
}

function toFormState(user?: UserSummaryResponse): FormState {
  return {
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    loggingEmail: user?.loggingEmail ?? "",
    password: "",
    confirmPassword: "",
    status: user?.status ?? UserStatus.Active,
    mustChangePassword: true,
    extras: "",
    roleIds: [],
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
  const [isLoadingRoles, setIsLoadingRoles] = useState(mode === "create");

  useEffect(() => {
    if (mode !== "create") return;
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
  }, [mode]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleRole(roleId: string) {
    setValues((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId],
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

      const passwordError = validate(values.password, [required(), minLength(8)]);
      if (passwordError) nextErrors.password = passwordError;

      if (values.password !== values.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match";
      }
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
              password: values.password,
              status: values.status,
              mustChangePassword: values.mustChangePassword,
              extras: values.extras.trim() || undefined,
              roleIds: values.roleIds.length > 0 ? values.roleIds : undefined,
            })
          : await updateUser(user!.id, {
              displayName: values.displayName.trim(),
              loggingEmail: values.loggingEmail.trim(),
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
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

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
          <div className="field-row">
            <PasswordField
              label="Initial Password *"
              name="password"
              value={values.password}
              error={errors.password}
              onChange={(e) => setField("password", e.target.value)}
            />
            <PasswordField
              label="Confirm Password *"
              name="confirmPassword"
              value={values.confirmPassword}
              error={errors.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
            />
          </div>
        )}

        {mode === "create" && (
          <div className="field">
            <label>Status *</label>
            <CustomSelect
              fullWidth
              label=""
              value={values.status}
              onChange={(val) => setField("status", val as UserStatus)}
              options={STATUS_OPTIONS}
            />
          </div>
        )}

        {mode === "create" && (
          <label className="field-checkbox-row">
            <input
              type="checkbox"
              checked={values.mustChangePassword}
              onChange={(e) => setField("mustChangePassword", e.target.checked)}
            />
            <span>Require password change on first login</span>
          </label>
        )}

        {mode === "create" && (
          <div className="field">
            <label>Roles</label>
            {isLoadingRoles ? (
              <div className="dialog-loading" style={{ padding: "12px 0" }}>
                <Spinner size={20} />
              </div>
            ) : availableRoles.length === 0 ? (
              <p className="field-hint">No roles exist for this tenant yet.</p>
            ) : (
              <div className="user-role-picker">
                {availableRoles.map((role) => (
                  <label key={role.id} className="user-role-picker-row">
                    <input
                      type="checkbox"
                      checked={values.roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "create" && (
          <div className="field">
            <label>Notes</label>
            <textarea
              className="field-textarea"
              rows={3}
              value={values.extras}
              onChange={(e) => setField("extras", e.target.value)}
              placeholder="Optional internal notes about this user"
            />
          </div>
        )}

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create user" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
