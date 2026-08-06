"use client";

import { useState, type FormEvent } from "react";
import type { MainStageResponse } from "@orelia/common";
import { createMainStage, updateMainStage } from "@/lib/api/main-stages";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";
import { FunnelIcon } from "@/components/ui/icons";

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
  mode: "create" | "edit";
  mainStage?: MainStageResponse;
  onClose: () => void;
  onSaved: (stage: MainStageResponse) => void;
}

export function MainStageFormDialog({
  mode,
  mainStage,
  onClose,
  onSaved,
}: MainStageFormDialogProps) {
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

  const titleText = mode === "create" ? "Add Main Stage" : mode === "view" ? "View Main Stage" : "Edit Main Stage";

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <FunnelIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">{titleText}</span>
        {mainStage && (
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
            {mainStage.name}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog
      open
<<<<<<< Updated upstream
      title={mode === "create" ? "Add Main Stage" : "Edit Main Stage"}
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
          placeholder="e.g. Lead, In Progress, Won"
          onChange={(e) => setField("name", e.target.value)}
        />

        <TextField
          label="Position"
          name="position"
          type="number"
          value={values.position}
          error={errors.position}
          onChange={(e) => setField("position", e.target.value)}
        />
        <p className="field-hint" style={{ marginTop: "-10px", marginBottom: "18px" }}>
          Used to order stages in the pipeline. Lower numbers appear first.
        </p>

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create stage" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
