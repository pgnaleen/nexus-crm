"use client";

import { useState, type FormEvent } from "react";
import { SystemRole, type RelationshipTypeResponse } from "@orelia/common";
import { createRelationshipType, updateRelationshipType } from "@/lib/api/relationship-types";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { minLength, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";

interface FormState {
  name: string;
  systemRole: SystemRole | "";
}

const SYSTEM_ROLE_OPTIONS = [
  { value: "", label: t("relationshipTypes.dialog.systemRoleNone") },
  { value: SystemRole.Customer, label: "Customer" },
  { value: SystemRole.Partner, label: "Partner" },
];

function systemRoleLabel(role: SystemRole | null): string {
  if (role === SystemRole.Customer) return "Customer";
  if (role === SystemRole.Partner) return "Partner";
  return t("relationshipTypes.dialog.systemRoleNone");
}

function toFormState(type?: RelationshipTypeResponse): FormState {
  return {
    name: type?.name ?? "",
    systemRole: type?.systemRole ?? "",
  };
}

interface RelationshipTypeFormDialogProps {
  mode: "create" | "edit" | "view";
  relationshipType?: RelationshipTypeResponse;
  onClose: () => void;
  onSaved: (type: RelationshipTypeResponse) => void;
}

export function RelationshipTypeFormDialog({
  mode,
  relationshipType,
  onClose,
  onSaved,
}: RelationshipTypeFormDialogProps) {
  const isViewOnly = mode === "view";
  const [values, setValues] = useState<FormState>(() => toFormState(relationshipType));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleNameChange(name: string) {
    setField("name", name);
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
      systemRole: values.systemRole === "" ? null : values.systemRole,
    };

    setIsSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createRelationshipType(payload)
          : await updateRelationshipType(relationshipType!.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save relationship type");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      title={mode === "create" ? "Add Relationship Type" : mode === "view" ? "View Relationship Type" : "Edit Relationship Type"}
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
          placeholder="e.g. Customer"
          onChange={(e) => handleNameChange(e.target.value)}
        />

        <div className="mb-[18px]">
          {isViewOnly ? (
            <TextField
              label={t("relationshipTypes.dialog.systemRoleLabel")}
              value={systemRoleLabel(relationshipType?.systemRole ?? null)}
              disabled
            />
          ) : (
            <>
              <CustomSelect
                label={t("relationshipTypes.dialog.systemRoleLabel")}
                fullWidth
                value={values.systemRole}
                onChange={(v) => setField("systemRole", v as SystemRole | "")}
                options={SYSTEM_ROLE_OPTIONS}
              />
              <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                {t("relationshipTypes.dialog.systemRoleHelp")}
              </p>
            </>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create type" : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
