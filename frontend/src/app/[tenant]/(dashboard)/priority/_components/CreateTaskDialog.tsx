"use client";

import { useState, type FormEvent } from "react";
import { PriorityTaskQuadrant, type PriorityTaskResponse } from "@orelia/common";
import { createPriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";
import { QUADRANT_ORDER } from "./types";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)]";

interface FormState {
  title: string;
  notes: string;
  quadrant: PriorityTaskQuadrant;
}

interface CreateTaskDialogProps {
  defaultQuadrant: PriorityTaskQuadrant;
  onClose: () => void;
  onCreated: (task: PriorityTaskResponse) => void;
}

export function CreateTaskDialog({ defaultQuadrant, onClose, onCreated }: CreateTaskDialogProps) {
  const [values, setValues] = useState<FormState>({ title: "", notes: "", quadrant: defaultQuadrant });
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const quadrantOptions = QUADRANT_ORDER.map((id) => ({
    value: id,
    label: t(`priorityTracker.quadrants.${id}.label`),
  }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const error = validate(values.title, [required(t("priorityTracker.dialog.errors.titleRequired"))]);
    setTitleError(error);
    if (error) return;

    setIsSaving(true);
    try {
      const created = await createPriorityTask({
        title: values.title.trim(),
        notes: values.notes.trim() || undefined,
        quadrant: values.quadrant,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("priorityTracker.dialog.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={t("priorityTracker.dialog.title")} onClose={onClose} maxWidth="480px">
      <form onSubmit={handleSubmit}>
        {formError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <TextField
          label={t("priorityTracker.dialog.titleLabel")}
          name="title"
          value={values.title}
          error={titleError}
          placeholder={t("priorityTracker.dialog.titlePlaceholder")}
          onChange={(e) => setValues((current) => ({ ...current, title: e.target.value }))}
        />

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
            {t("priorityTracker.dialog.quadrantLabel")}
          </label>
          <CustomSelect
            fullWidth
            label=""
            value={values.quadrant}
            onChange={(val) => setValues((current) => ({ ...current, quadrant: val as PriorityTaskQuadrant }))}
            options={quadrantOptions}
          />
        </div>

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
            {t("priorityTracker.dialog.notesLabel")}
          </label>
          <textarea
            className={TEXTAREA_CLASS}
            rows={3}
            value={values.notes}
            placeholder={t("priorityTracker.dialog.notesPlaceholder")}
            onChange={(e) => setValues((current) => ({ ...current, notes: e.target.value }))}
          />
        </div>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {t("priorityTracker.dialog.createButton")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
