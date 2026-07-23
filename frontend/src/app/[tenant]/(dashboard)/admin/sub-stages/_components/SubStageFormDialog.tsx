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
  mode: "create" | "edit" | "view";
  subStage?: DealStageResponse;
  mainStages: MainStageResponse[];
  // Every other Sub Stage, used to reject a sort order already taken by a
  // sibling under the same Main Stage (excluding this one in edit mode).
  subStages: DealStageResponse[];
  onClose: () => void;
  onSaved: (subStage: DealStageResponse) => void;
}

export function SubStageFormDialog({
  mode,
  subStage,
  mainStages,
  subStages,
  onClose,
  onSaved,
}: SubStageFormDialogProps) {
  const isViewOnly = mode === "view";
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

    const sortParsed = parseInt(values.sortOrder, 10);
    if (isNaN(sortParsed)) {
      nextErrors.sortOrder = "Must be a valid number";
    } else if (sortParsed < 0) {
      nextErrors.sortOrder = "Sort order can't be negative";
    } else {
      const conflict = subStages.find(
        (row) =>
          row.id !== subStage?.id && row.mainStageId === values.mainStageId && row.sortOrder === sortParsed,
      );
      if (conflict) {
        nextErrors.sortOrder = `Sort order ${sortParsed} is already used by "${conflict.name}" under this main stage`;
      }
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
      title={mode === "create" ? "Add Sub Stage" : mode === "view" ? "View Sub Stage" : "Edit Sub Stage"}
      onClose={onClose}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
            Main stage *
          </label>
          {isViewOnly ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[#f8fafc] px-3 py-2.5 text-sm text-[var(--color-text-muted)]">
              {mainStageOptions.find((opt) => opt.value === values.mainStageId)?.label ?? "—"}
            </div>
          ) : (
            <>
              <CustomSelect
                fullWidth
                label=""
                value={values.mainStageId}
                onChange={(val) => setField("mainStageId", val)}
                options={mainStageOptions}
              />
              {errors.mainStageId && (
                <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{errors.mainStageId}</p>
              )}
            </>
          )}
        </div>

        <TextField
          label="Name *"
          name="name"
          value={values.name}
          error={errors.name}
          disabled={isViewOnly}
          placeholder="e.g. Qualified, Proposal Sent"
          onChange={(e) => setField("name", e.target.value)}
        />

        <TextField
          label="Sort order"
          name="sortOrder"
          type="number"
          min="0"
          value={values.sortOrder}
          error={errors.sortOrder}
          disabled={isViewOnly}
          onChange={(e) => setField("sortOrder", e.target.value)}
        />

        <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
          <input
            type="checkbox"
            checked={values.isWon}
            disabled={isViewOnly}
            onChange={(e) => setField("isWon", e.target.checked)}
          />
          <span>Won — this stage represents a closed-won outcome</span>
        </label>

        <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
          <input
            type="checkbox"
            checked={values.isLost}
            disabled={isViewOnly}
            onChange={(e) => setField("isLost", e.target.checked)}
          />
          <span>Lost — this stage represents a closed-lost outcome</span>
        </label>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create sub stage" : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
