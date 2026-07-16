"use client";

import { useState, type FormEvent } from "react";
import type { TeamResponse } from "@orelia/common";
import { createTeam, updateTeam } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";

interface FormState {
  name: string;
}

function toFormState(team?: TeamResponse): FormState {
  return {
    name: team?.name ?? "",
  };
}

interface TeamFormDialogProps {
  mode: "create" | "edit";
  team?: TeamResponse;
  onClose: () => void;
  onSaved: (team: TeamResponse) => void;
}

export function TeamFormDialog({ mode, team, onClose, onSaved }: TeamFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(team));
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

    const payload = { name: values.name.trim() };

    setIsSaving(true);
    try {
      const saved = mode === "create" ? await createTeam(payload) : await updateTeam(team!.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save team");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={mode === "create" ? "Add Team" : "Edit Team"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        <TextField
          label="Name *"
          name="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => setField("name", e.target.value)}
        />

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create team" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
