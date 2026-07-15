"use client";

import { useState, type FormEvent } from "react";
import {
  IndustryResponse,
  PlanResponse,
  TenantResponse,
  TenantStatus,
} from "@orelia/common";
import { createTenant, updateTenant } from "@/lib/api/tenants";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { email, minLength, pattern, required, validate } from "@/lib/validation";

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

interface FormState {
  name: string;
  slug: string;
  planId: string;
  industryId: string;
  status: TenantStatus;
  tagline: string;
  phoneNo: string;
  contactEmail: string;
  billingEmail: string;
  address: string;
}

function toFormState(tenant?: TenantResponse): FormState {
  return {
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    planId: tenant?.planId ?? "",
    industryId: tenant?.industryId ?? "",
    status: tenant?.status ?? TenantStatus.Trial,
    tagline: tenant?.tagline ?? "",
    phoneNo: tenant?.phoneNo ?? "",
    contactEmail: tenant?.contactEmail ?? "",
    billingEmail: tenant?.billingEmail ?? "",
    address: tenant?.address ?? "",
  };
}

interface TenantFormDialogProps {
  mode: "create" | "edit";
  tenant?: TenantResponse;
  plans: PlanResponse[];
  industries: IndustryResponse[];
  onClose: () => void;
  onSaved: (tenant: TenantResponse) => void;
}

export function TenantFormDialog({ mode, tenant, plans, industries, onClose, onSaved }: TenantFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(tenant));
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

    const slugError = validate(values.slug, [
      required(),
      minLength(2),
      pattern(SLUG_REGEX, "Lowercase letters, numbers, and hyphens only"),
    ]);
    if (slugError) nextErrors.slug = slugError;

    if (!values.planId) nextErrors.planId = "Select a plan";

    const contactEmailError = validate(values.contactEmail, [email()]);
    if (contactEmailError) nextErrors.contactEmail = contactEmailError;

    const billingEmailError = validate(values.billingEmail, [email()]);
    if (billingEmailError) nextErrors.billingEmail = billingEmailError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      planId: values.planId,
      industryId: values.industryId || undefined,
      status: values.status,
      tagline: values.tagline.trim() || undefined,
      phoneNo: values.phoneNo.trim() || undefined,
      contactEmail: values.contactEmail.trim() || undefined,
      billingEmail: values.billingEmail.trim() || undefined,
      address: values.address.trim() || undefined,
    };

    setIsSaving(true);
    try {
      const saved =
        mode === "create" ? await createTenant(payload) : await updateTenant(tenant!.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save tenant");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={mode === "create" ? "Add Tenant" : "Edit Tenant"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        <div className="field-row">
          <TextField
            label="Name"
            name="name"
            value={values.name}
            error={errors.name}
            onChange={(e) => setField("name", e.target.value)}
          />
          <TextField
            label="Slug"
            name="slug"
            value={values.slug}
            error={errors.slug}
            onChange={(e) => setField("slug", e.target.value.toLowerCase())}
          />
        </div>

        <div className="field-row">
          <div className={errors.planId ? "field has-error" : "field"}>
            <label htmlFor="planId">Plan</label>
            <select
              id="planId"
              value={values.planId}
              onChange={(e) => setField("planId", e.target.value)}
            >
              <option value="">Select a plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            {errors.planId && <p className="field-error">{errors.planId}</p>}
          </div>

          <div className="field">
            <label htmlFor="industryId">Industry</label>
            <select
              id="industryId"
              value={values.industryId}
              onChange={(e) => setField("industryId", e.target.value)}
            >
              <option value="">—</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={values.status}
            onChange={(e) => setField("status", e.target.value as TenantStatus)}
          >
            {Object.values(TenantStatus).map((status) => (
              <option key={status} value={status}>
                {status[0].toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <TextField
          label="Tagline"
          name="tagline"
          value={values.tagline}
          onChange={(e) => setField("tagline", e.target.value)}
        />

        <div className="field-row">
          <TextField
            label="Contact email"
            name="contactEmail"
            type="email"
            value={values.contactEmail}
            error={errors.contactEmail}
            onChange={(e) => setField("contactEmail", e.target.value)}
          />
          <TextField
            label="Billing email"
            name="billingEmail"
            type="email"
            value={values.billingEmail}
            error={errors.billingEmail}
            onChange={(e) => setField("billingEmail", e.target.value)}
          />
        </div>

        <div className="field-row">
          <TextField
            label="Phone"
            name="phoneNo"
            value={values.phoneNo}
            onChange={(e) => setField("phoneNo", e.target.value)}
          />
          <TextField
            label="Address"
            name="address"
            value={values.address}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create tenant" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
