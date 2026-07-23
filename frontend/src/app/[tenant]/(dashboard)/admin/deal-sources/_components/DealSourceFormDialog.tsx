"use client";

import { useState, type FormEvent } from "react";
import { DealSourceCategory } from "@orelia/common";
import type { DealSourceResponse } from "@orelia/common";
import { createDealSource, updateDealSource } from "@/lib/api/deal-sources";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { minLength, required, validate } from "@/lib/validation";

export const CATEGORY_LABELS: Record<DealSourceCategory, string> = {
  [DealSourceCategory.Referral]: "Referral",
  [DealSourceCategory.DirectSales]: "Direct Sales",
  [DealSourceCategory.Marketing]: "Marketing",
  [DealSourceCategory.Partner]: "Partner",
  [DealSourceCategory.Event]: "Event",
  [DealSourceCategory.ExistingCustomer]: "Existing Customer",
  [DealSourceCategory.Marketplace]: "Marketplace",
  [DealSourceCategory.TenderRfp]: "Tender/RFP",
  [DealSourceCategory.StrategicRelationship]: "Strategic Relationship",
  [DealSourceCategory.Other]: "Other",
};

const CATEGORY_OPTIONS = [
  { value: "", label: "No category" },
  ...Object.values(DealSourceCategory).map((value) => ({ value, label: CATEGORY_LABELS[value] })),
];

interface FormState {
  name: string;
  category: DealSourceCategory | "";
  isActive: boolean;
}

function toFormState(source?: DealSourceResponse): FormState {
  return {
    name: source?.name ?? "",
    category: source?.category ?? "",
    isActive: source?.isActive ?? true,
  };
}

interface DealSourceFormDialogProps {
  mode: "create" | "edit" | "view";
  dealSource?: DealSourceResponse;
  onClose: () => void;
  onSaved: (source: DealSourceResponse) => void;
}

export function DealSourceFormDialog({
  mode,
  dealSource,
  onClose,
  onSaved,
}: DealSourceFormDialogProps) {
  const isViewOnly = mode === "view";
  const [values, setValues] = useState<FormState>(() => toFormState(dealSource));
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

    setIsSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createDealSource({
              name: values.name.trim(),
              category: values.category || undefined,
              isActive: values.isActive,
            })
          : await updateDealSource(dealSource!.id, {
              name: values.name.trim(),
              // null explicitly clears the category (picking "No category");
              // never send undefined here, or a real clear would silently
              // no-op against the "omitted = leave untouched" PATCH semantics.
              category: values.category || null,
              isActive: values.isActive,
            });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save deal source");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      title={mode === "create" ? "Add Deal Source" : mode === "view" ? "View Deal Source" : "Edit Deal Source"}
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
          placeholder="e.g. CEO, Partner, Supplier, Customer, Direct"
          onChange={(e) => setField("name", e.target.value)}
        />

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
            Category
          </label>
          {isViewOnly ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[#f8fafc] px-3 py-2.5 text-sm text-[var(--color-text-muted)]">
              {CATEGORY_OPTIONS.find((opt) => opt.value === values.category)?.label ?? "No category"}
            </div>
          ) : (
            <CustomSelect
              fullWidth
              label=""
              value={values.category}
              onChange={(val) => setField("category", val as DealSourceCategory | "")}
              options={CATEGORY_OPTIONS}
            />
          )}
        </div>

        <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
          <input
            type="checkbox"
            checked={values.isActive}
            disabled={isViewOnly}
            onChange={(e) => setField("isActive", e.target.checked)}
          />
          <span>Active — visible when assigning a source to a deal</span>
        </label>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create source" : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
