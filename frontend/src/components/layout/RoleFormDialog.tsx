"use client";

import { useState, type FormEvent } from "react";
import type { RbacRoleResponse } from "@orelia/common";
import { createRole, updateRole } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";

interface FormState {
  name: string;
  description: string;
}

function toFormState(role?: RbacRoleResponse): FormState {
  return {
    name: role?.name ?? "",
    description: role?.description ?? "",
  };
}

interface RoleFormDialogProps {
  mode: "create" | "edit";
  role?: RbacRoleResponse;
  onClose: () => void;
  onSaved: (role: RbacRoleResponse) => void;
}

export function RoleFormDialog({ mode, role, onClose, onSaved }: RoleFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(role));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.name, [required(), minLength(2)]);
    if (nameError) nextErrors.name = nameError;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
    };

    setIsSaving(true);
    try {
      const saved = mode === "create" ? await createRole(payload) : await updateRole(role!.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save role");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={mode === "create" ? "Add Role" : "Edit Role"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        <TextField
          label="Name *"
          name="name"
          required
          aria-required="true"
          value={values.name}
          error={errors.name}
          onChange={(e) => setField("name", e.target.value)}
        />

        <TextField
          label="Description"
          name="description"
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
        />

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create role" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
