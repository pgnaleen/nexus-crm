"use client";

import { useState, type FormEvent } from "react";
import { RoleBuying } from "@orelia/common";
import type { CompanyPickerResponse, ContactResponse } from "@orelia/common";
import {
  createRelationshipPartyContact,
  updateRelationshipPartyContact,
} from "@/lib/api/relationship-parties";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PhoneField } from "@/components/ui/PhoneField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { email as emailValidator, minLength, required, validate } from "@/lib/validation";

const ROLE_BUYING_LABELS: Record<RoleBuying, string> = {
  [RoleBuying.EconomicBuyer]: "Economic Buyer",
  [RoleBuying.Champion]: "Champion",
  [RoleBuying.Influencer]: "Influencer",
  [RoleBuying.Gatekeeper]: "Gatekeeper",
  [RoleBuying.EndUser]: "End User",
  [RoleBuying.Blocker]: "Blocker",
};

const ROLE_BUYING_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(RoleBuying).map((value) => ({ value, label: ROLE_BUYING_LABELS[value] })),
];

interface FormState {
  fullName: string;
  title: string;
  department: string;
  roleBuying: RoleBuying | "";
  email: string;
  mobileNo: string;
  directPhoneNo: string;
  linkedIn: string;
  country: string;
  timezone: string;
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

type TabId = "details" | "contact";

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
  const [activeTab, setActiveTab] = useState<TabId>("details");
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
    if (Object.keys(nextErrors).length > 0) {
      setActiveTab("details");
      return false;
    }
    return true;
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
          title: values.title.trim(),
          department: values.department.trim(),
          roleBuying: values.roleBuying || null,
          email: values.email.trim(),
          mobileNo: values.mobileNo.trim(),
          directPhoneNo: values.directPhoneNo.trim(),
          linkedIn: values.linkedIn.trim(),
          country: values.country.trim(),
          timezone: values.timezone.trim(),
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
        <div className="dialog-tabs">
          <button
            type="button"
            className={`dialog-tab${activeTab === "details" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Person Details
          </button>
          <button
            type="button"
            className={`dialog-tab${activeTab === "contact" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("contact")}
          >
            Contact Details
          </button>
        </div>

        {formError && <p className="field-error">{formError}</p>}

        {/* ── Tab 1: Person Details ──────────────────────── */}
        {activeTab === "details" && (
          <div>
            <TextField
              label="Full name *"
              name="fullName"
              value={values.fullName}
              error={errors.fullName}
              placeholder="e.g. Jane Doe"
              onChange={(e) => setField("fullName", e.target.value)}
            />

            <div className="field-row">
              <TextField
                label="Title"
                name="title"
                value={values.title}
                onChange={(e) => setField("title", e.target.value)}
              />
              <TextField
                label="Department"
                name="department"
                value={values.department}
                onChange={(e) => setField("department", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Buying role</label>
              <CustomSelect
                fullWidth
                label=""
                value={values.roleBuying}
                onChange={(val) => setField("roleBuying", val as RoleBuying | "")}
                options={ROLE_BUYING_OPTIONS}
              />
            </div>

            <TextField
              label="Email"
              name="email"
              type="email"
              value={values.email}
              error={errors.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>
        )}

        {/* ── Tab 2: Contact Details ──────────────────────── */}
        {activeTab === "contact" && (
          <div>
            <div className="field-row">
              <PhoneField
                label="Mobile number"
                name="mobileNo"
                value={values.mobileNo}
                onChange={(val) => setField("mobileNo", val)}
              />
              <TextField
                label="Direct phone number"
                name="directPhoneNo"
                value={values.directPhoneNo}
                onChange={(e) => setField("directPhoneNo", e.target.value)}
              />
            </div>

            <TextField
              label="LinkedIn"
              name="linkedIn"
              value={values.linkedIn}
              onChange={(e) => setField("linkedIn", e.target.value)}
            />

            <div className="field-row">
              <TextField
                label="Country"
                name="country"
                value={values.country}
                onChange={(e) => setField("country", e.target.value)}
              />
              <TextField
                label="Timezone"
                name="timezone"
                value={values.timezone}
                onChange={(e) => setField("timezone", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Company</label>
              <CustomSelect
                fullWidth
                label=""
                value={values.companyId}
                onChange={(val) => setField("companyId", val)}
                options={companyOptions}
              />
            </div>
          </div>
        )}

        <div className="dialog-actions">
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
