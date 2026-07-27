"use client";

import { useState, type FormEvent } from "react";
import type { CompanyPickerResponse, ContactResponse } from "@orelia/common";
import {
  createRelationshipPartyContact,
  updateRelationshipPartyContact,
} from "@/lib/api/relationship-parties";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { email as emailValidator, minLength, required, validate } from "@/lib/validation";
import { ContactFields, type ContactFieldsValue } from "./ContactFields";

interface FormState extends ContactFieldsValue {
  companyId: string;
}

function toFormState(contact?: ContactResponse): FormState {
  return {
    fullName: contact?.fullName ?? "",
    title: contact?.title ?? "",
    department: contact?.department ?? "",
    roleBuying: contact?.roleBuying ?? "",
    email: contact?.email ?? "",
    mobileNo: contact?.mobileNo ?? "",
    directPhoneNo: contact?.directPhoneNo ?? "",
    linkedIn: contact?.linkedIn ?? "",
    country: contact?.country ?? "",
    timezone: contact?.timezone ?? "",
    companyId: contact?.companyId ?? "",
  };
}

interface ContactFormDialogProps {
  mode: "create" | "edit";
  relationshipTypeId: string;
  relationshipTypeName: string;
  mapId?: string;
  contact?: ContactResponse;
  companies: CompanyPickerResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function ContactFormDialog({
  mode,
  relationshipTypeId,
  relationshipTypeName,
  mapId,
  contact,
  companies,
  onClose,
  onSaved,
}: ContactFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(contact));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.fullName, [required(), minLength(1)]);
    if (nameError) nextErrors.fullName = nameError;
    if (values.email) {
      const emailError = validate(values.email, [emailValidator()]);
      if (emailError) nextErrors.email = emailError;
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
      if (mode === "create") {
        await createRelationshipPartyContact(relationshipTypeId, {
          fullName: values.fullName.trim(),
          title: values.title.trim() || undefined,
          department: values.department.trim() || undefined,
          roleBuying: values.roleBuying || undefined,
          email: values.email.trim() || undefined,
          mobileNo: values.mobileNo.trim() || undefined,
          directPhoneNo: values.directPhoneNo.trim() || undefined,
          linkedIn: values.linkedIn.trim() || undefined,
          country: values.country.trim() || undefined,
          timezone: values.timezone.trim() || undefined,
          companyId: values.companyId || undefined,
        });
      } else {
        // PATCH semantics: omitted keys are left untouched, so every field
        // must be sent with its real current value (or null to clear the
        // enum) rather than undefined, or a clear would silently no-op.
        await updateRelationshipPartyContact(relationshipTypeId, mapId!, {
          fullName: values.fullName.trim(),
          title: values.title.trim() || undefined,
          department: values.department.trim() || undefined,
          roleBuying: values.roleBuying || null,
          email: values.email.trim() || undefined,
          mobileNo: values.mobileNo.trim() || undefined,
          directPhoneNo: values.directPhoneNo.trim() || undefined,
          linkedIn: values.linkedIn.trim() || undefined,
          country: values.country.trim() || undefined,
          timezone: values.timezone.trim() || undefined,
          companyId: values.companyId || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save contact");
    } finally {
      setIsSaving(false);
    }
  }

  const companyOptions = [
    { value: "", label: "None" },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Dialog
      open
      title={mode === "create" ? `Add Person (${relationshipTypeName})` : "Edit Person"}
      onClose={onClose}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <ContactFields
          values={values}
          fullNameError={errors.fullName}
          fullNameRequired
          onChange={(field, value) => setField(field, value as never)}
        />

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Company</label>
          <CustomSelect
            fullWidth
            label=""
            value={values.companyId}
            onChange={(val) => setField("companyId", val)}
            options={companyOptions}
          />
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            Select a company only if this contact works under an organization. Leave as &quot;None&quot; to list them as an individual standalone person.
          </p>
        </div>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create person" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
