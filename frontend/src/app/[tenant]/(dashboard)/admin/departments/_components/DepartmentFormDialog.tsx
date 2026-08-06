"use client";

import { useState, type FormEvent } from "react";
import type { DepartmentResponse } from "@orelia/common";
import { createDepartment, updateDepartment } from "@/lib/api/departments";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";
<<<<<<< Updated upstream
=======
import { t } from "@/lib/i18n";
import { SettingsIcon } from "@/components/ui/icons";
>>>>>>> Stashed changes

interface FormState {
  name: string;
  isActive: boolean;
}

function toFormState(department?: DepartmentResponse): FormState {
  return {
    name: department?.name ?? "",
    isActive: department?.isActive ?? true,
  };
}

interface DepartmentFormDialogProps {
  mode: "create" | "edit";
  department?: DepartmentResponse;
  onClose: () => void;
  onSaved: (department: DepartmentResponse) => void;
}

export function DepartmentFormDialog({
  mode,
  department,
  onClose,
  onSaved,
}: DepartmentFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(department));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.name, [required(), minLength(1)]);
    if (nameError) nextErrors.name = nameError;
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
          ? await createDepartment({
              name: values.name.trim(),
              isActive: values.isActive,
            })
          : await updateDepartment(department!.id, {
              name: values.name.trim(),
              isActive: values.isActive,
            });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save department");
    } finally {
      setIsSaving(false);
    }
  }

  const titleText =
    mode === "create"
      ? t("departments.dialog.addTitle")
      : mode === "view"
        ? t("departments.dialog.viewTitle")
        : t("departments.dialog.editTitle");

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <SettingsIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">{titleText}</span>
        {department && (
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
            {department.name}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog
      open
<<<<<<< Updated upstream
      title={mode === "create" ? "Add Department" : "Edit Department"}
=======
      title={dialogTitle}
>>>>>>> Stashed changes
      onClose={onClose}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        <TextField
          label="Name *"
          name="name"
          value={values.name}
          error={errors.name}
          placeholder="e.g. Engineering, Finance, Human Resources"
          onChange={(e) => setField("name", e.target.value)}
        />

        <label className="field-checkbox-row">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
          />
          <span>Active — visible when assigning employees to a department</span>
        </label>

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create department" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
