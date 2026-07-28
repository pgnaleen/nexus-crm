"use client";

import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface CascadeDeleteConfirmDialogProps {
  open: boolean;
  title: string;
  warningMessage: string;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string | null;
  verifying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Distinct from ConfirmDialog -- this variant is for deletes that cascade to
// dependent records. Per CLAUDE.md's cascade-delete rule: a red-styled
// warning stating what else gets deleted, plus a required password
// re-entry, verified server-side before the delete is allowed to proceed.
export function CascadeDeleteConfirmDialog({
  open,
  title,
  warningMessage,
  password,
  onPasswordChange,
  error,
  verifying,
  onConfirm,
  onCancel,
}: CascadeDeleteConfirmDialogProps) {
  const canConfirm = password.trim().length > 0 && !verifying;

  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      <div className="rounded-lg border border-[var(--color-crm-primary)] bg-[var(--color-crm-primary-tint)] p-4">
        <p className="text-sm font-semibold text-[var(--color-crm-primary)]">
          This will also delete related records
        </p>
        <p className="mt-1 text-sm text-[var(--color-crm-text)]">{warningMessage}</p>
      </div>

      <div className="mt-4">
        <label htmlFor="cascade-delete-password" className="block text-sm font-medium text-[var(--color-crm-text)]">
          Enter your account password to confirm
        </label>
        <input
          id="cascade-delete-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canConfirm) onConfirm();
          }}
          placeholder="Current password"
          className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm transition-colors duration-150 focus:outline-none focus:border-[var(--color-crm-primary)] focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)]"
        />
        {error && <p className="mt-2 text-sm font-medium text-[var(--color-crm-primary)]">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-[var(--color-border)] pt-5">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={verifying}>
          Cancel
        </Button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="cursor-pointer rounded-lg border-0 bg-[var(--color-crm-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-crm-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verifying ? "Verifying..." : "Delete"}
        </button>
      </div>
    </Dialog>
  );
}
