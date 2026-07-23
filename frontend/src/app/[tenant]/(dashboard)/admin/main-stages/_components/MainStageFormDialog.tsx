"use client";

import { useState, type FormEvent } from "react";
import type { MainStageResponse } from "@orelia/common";
import { createMainStage, updateMainStage } from "@/lib/api/main-stages";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";

interface FormState {
  name: string;
  position: string;
}

function toFormState(stage?: MainStageResponse): FormState {
  return {
    name: stage?.name ?? "",
    position: stage?.position?.toString() ?? "0",
  };
}

interface MainStageFormDialogProps {
  mode: "create" | "edit" | "view";
  mainStage?: MainStageResponse;
  // Every other Main Stage, used to reject a position that's already taken
  // (excluding this stage itself in edit mode).
  mainStages: MainStageResponse[];
  onClose: () => void;
  onSaved: (stage: MainStageResponse) => void;
}

export function MainStageFormDialog({
  mode,
  mainStage,
  mainStages,
  onClose,
  onSaved,
}: MainStageFormDialogProps) {
  const isViewOnly = mode === "view";
  const [values, setValues] = useState<FormState>(() => toFormState(mainStage));
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

    const posParsed = parseInt(values.position, 10);
    if (isNaN(posParsed)) {
      nextErrors.position = "Must be a valid number";
    } else if (posParsed < 0) {
      nextErrors.position = "Position can't be negative";
    } else {
      const conflict = mainStages.find((stage) => stage.id !== mainStage?.id && stage.position === posParsed);
      if (conflict) {
        nextErrors.position = `Position ${posParsed} is already used by "${conflict.name}"`;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    const payload = {
      name: values.name.trim(),
      position: parseInt(values.position, 10) || 0,
    };

    setIsSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createMainStage(payload)
          : await updateMainStage(mainStage!.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save main stage");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      title={mode === "create" ? "Add Main Stage" : mode === "view" ? "View Main Stage" : "Edit Main Stage"}
      onClose={onClose}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <TextField
          label="Name *"
          name="name"
          value={values.name}
          error={errors.name}
          disabled={isViewOnly}
          placeholder="e.g. Lead, In Progress, Won"
          onChange={(e) => setField("name", e.target.value)}
        />

        <TextField
          label="Position"
          name="position"
          type="number"
          min="0"
          value={values.position}
          error={errors.position}
          disabled={isViewOnly}
          onChange={(e) => setField("position", e.target.value)}
        />
        <p className="-mt-2.5 mb-[18px] text-[13px] text-[var(--color-text-muted)]">
          Used to order stages in the pipeline. Lower numbers appear first.
        </p>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create stage" : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
