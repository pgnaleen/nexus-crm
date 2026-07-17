"use client";

import { useState, type FormEvent } from "react";
import type { DealStageResponse, MainStageResponse } from "@orelia/common";
import { createSubStage, updateSubStage } from "@/lib/api/sub-stages";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { minLength, required, validate } from "@/lib/validation";

interface FormState {
  name: string;
  sortOrder: string;
  isWon: boolean;
  isLost: boolean;
  mainStageId: string;
}

function toFormState(subStage: DealStageResponse | undefined, defaultMainStageId: string): FormState {
  return {
    name: subStage?.name ?? "",
    sortOrder: subStage != null ? String(subStage.sortOrder) : "0",
    isWon: subStage?.isWon ?? false,
    isLost: subStage?.isLost ?? false,
    mainStageId: subStage?.mainStageId ?? defaultMainStageId,
  };
}

interface SubStageFormDialogProps {
  mode: "create" | "edit";
  subStage?: DealStageResponse;
  mainStages: MainStageResponse[];
  onClose: () => void;
  onSaved: (subStage: DealStageResponse) => void;
}

export function SubStageFormDialog({
  mode,
  subStage,
  mainStages,
  onClose,
  onSaved,
}: SubStageFormDialogProps) {
  const [values, setValues] = useState<FormState>(() =>
    toFormState(subStage, mainStages[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mainStageOptions = mainStages.map((stage) => ({ value: stage.id, label: stage.name }));

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.name, [required(), minLength(1)]);
    if (nameError) nextErrors.name = nameError;
    if (!values.mainStageId) nextErrors.mainStageId = "Select a main stage";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        sortOrder: Number(values.sortOrder) || 0,
        isWon: values.isWon,
        isLost: values.isLost,
        mainStageId: values.mainStageId,
      };
      const saved =
        mode === "create"
          ? await createSubStage(payload)
          : await updateSubStage(subStage!.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save sub stage");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      title={mode === "create" ? "Add Sub Stage" : "Edit Sub Stage"}
      onClose={onClose}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        <div className="field">
          <label>Main stage *</label>
          <CustomSelect
            fullWidth
            label=""
            value={values.mainStageId}
            onChange={(val) => setField("mainStageId", val)}
            options={mainStageOptions}
          />
          {errors.mainStageId && <p className="field-error">{errors.mainStageId}</p>}
        </div>

        <TextField
          label="Name *"
          name="name"
          value={values.name}
          error={errors.name}
          placeholder="e.g. Qualified, Proposal Sent"
          onChange={(e) => setField("name", e.target.value)}
        />

        <TextField
          label="Sort order"
          name="sortOrder"
          type="number"
          value={values.sortOrder}
          onChange={(e) => setField("sortOrder", e.target.value)}
        />

        <label className="field-checkbox-row">
          <input
            type="checkbox"
            checked={values.isWon}
            onChange={(e) => setField("isWon", e.target.checked)}
          />
          <span>Won — this stage represents a closed-won outcome</span>
        </label>

        <label className="field-checkbox-row">
          <input
            type="checkbox"
            checked={values.isLost}
            onChange={(e) => setField("isLost", e.target.checked)}
          />
          <span>Lost — this stage represents a closed-lost outcome</span>
        </label>

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create sub stage" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
