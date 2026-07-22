"use client";

import { useState, type FormEvent } from "react";
import type { RelationshipTypeResponse } from "@orelia/common";
import { createRelationshipType, updateRelationshipType } from "@/lib/api/relationship-types";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { minLength, required, validate } from "@/lib/validation";

interface FormState {
  name: string;
}

function toFormState(type?: RelationshipTypeResponse): FormState {
  return {
    name: type?.name ?? "",
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
        {formError && <p className="field-error">{formError}</p>}

        <TextField
          label="Name *"
          name="name"
          value={values.name}
          error={errors.name}
          disabled={isViewOnly}
          placeholder="e.g. Customer"
          onChange={(e) => handleNameChange(e.target.value)}
        />

        <div className="dialog-actions">
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
