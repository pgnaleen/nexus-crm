"use client";

import { useState, type FormEvent } from "react";
import { changeOwnPassword } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { PasswordStrengthHint } from "@/components/ui/PasswordStrengthHint";
import { minLength, required, strongPassword, validate } from "@/lib/validation";

interface FormState {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

const EMPTY_FORM: FormState = { currentPassword: "", newPassword: "", confirmNewPassword: "" };

export function ChangePasswordForm() {
  const [values, setValues] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    const currentPasswordError = validate(values.currentPassword, [required("Enter your current password")]);
    if (currentPasswordError) nextErrors.currentPassword = currentPasswordError;

    const newPasswordError = validate(values.newPassword, [required(), minLength(8), strongPassword()]);
    if (newPasswordError) nextErrors.newPassword = newPasswordError;

    if (values.newPassword !== values.confirmNewPassword) {
      nextErrors.confirmNewPassword = "Passwords do not match";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      await changeOwnPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setValues(EMPTY_FORM);
      setErrors({});
      setSuccessMessage("Password changed. You've been signed out of your other sessions.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setErrors({ currentPassword: "Current password is incorrect" });
      } else {
        setFormError(err instanceof ApiError ? err.message : "Failed to change password");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}
      {successMessage && (
        <p className="mb-4 text-[13px] text-[#059669]">
          {successMessage}
        </p>
      )}

      <PasswordField
        label="Current Password *"
        name="currentPassword"
        value={values.currentPassword}
        error={errors.currentPassword}
        onChange={(e) => setField("currentPassword", e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3.5">
        <PasswordField
          label="New Password *"
          name="newPassword"
          value={values.newPassword}
          error={errors.newPassword}
          onChange={(e) => setField("newPassword", e.target.value)}
        />
        <PasswordField
          label="Confirm New Password *"
          name="confirmNewPassword"
          value={values.confirmNewPassword}
          error={errors.confirmNewPassword}
          onChange={(e) => setField("confirmNewPassword", e.target.value)}
        />
      </div>
      <PasswordStrengthHint password={values.newPassword} />

      <div className="mt-2 flex justify-end gap-2.5">
        <Button type="submit" isLoading={isSaving}>
          Change password
        </Button>
      </div>
    </form>
  );
}
