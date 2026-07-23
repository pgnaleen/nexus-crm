"use client";

import { useState, type FormEvent } from "react";
import type { UserSummaryResponse } from "@orelia/common";
import { resetUserPassword } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { PasswordStrengthHint } from "@/components/ui/PasswordStrengthHint";
import { minLength, required, strongPassword, validate } from "@/lib/validation";

interface ResetPasswordDialogProps {
  user: UserSummaryResponse;
  onClose: () => void;
  onReset: () => void;
}

export function ResetPasswordDialog({ user, onClose, onReset }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function runValidation(): boolean {
    const nextErrors: { password?: string; confirmPassword?: string } = {};
    const passwordError = validate(password, [required(), minLength(8), strongPassword()]);
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      await resetUserPassword(user.id, { password });
      onReset();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={`Reset Password — ${user.displayName}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mt-0 mb-4 text-[13px] text-[var(--color-text-muted)]">
          Sets a temporary password for this user. They will be required to change it on next login.
        </p>

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <PasswordField
          label="New Password *"
          name="password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthHint password={password} />
        <PasswordField
          label="Confirm New Password *"
          name="confirmPassword"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Reset password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
