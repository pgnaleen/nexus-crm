"use client";

import { useState, type FormEvent } from "react";
import type { DepartmentResponse } from "@orelia/common";
import { createDepartment, updateDepartment } from "@/lib/api/departments";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";

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
  mode: "create" | "edit" | "view";
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
  const isViewOnly = mode === "view";
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

  return (
    <Dialog
      open
      title={mode === "create" ? "Add Department" : mode === "view" ? "View Department" : "Edit Department"}
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
          disabled={isViewOnly}
          placeholder="e.g. Engineering, Finance, Human Resources"
          onChange={(e) => setField("name", e.target.value)}
        />

        <label className="field-checkbox-row">
          <input
            type="checkbox"
            checked={values.isActive}
            disabled={isViewOnly}
            onChange={(e) => setField("isActive", e.target.checked)}
          />
          <span>Active — visible when assigning employees to a department</span>
        </label>

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create department" : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
