"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  IndustryResponse,
  PlanResponse,
  TenantResponse,
  TenantStatus,
  TenantSummaryResponse,
} from "@orelia/common";
import { createTenant, getTenant, updateTenant } from "@/lib/api/tenants";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { EmailField } from "@/components/ui/EmailField";
import { PhoneField } from "@/components/ui/PhoneField";
import { CustomSelect } from "@/components/ui/CustomSelect";
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
  tenant?: TenantSummaryResponse;
  plans: PlanResponse[];
  industries: IndustryResponse[];
  onClose: () => void;
  onSaved: (tenant: TenantResponse) => void;
}

export function TenantFormDialog({ mode, tenant, plans, industries, onClose, onSaved }: TenantFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !tenant) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    getTenant(tenant.id)
      .then((full) => {
        if (!cancelled) setValues(toFormState(full));
      })
      .catch(() => {
        if (!cancelled) setFormError("Failed to load tenant details");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tenant?.id]);

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

    const contactEmailError = validate(values.contactEmail, [required(), email()]);
    if (contactEmailError) nextErrors.contactEmail = contactEmailError;

    const billingEmailError = validate(values.billingEmail, [email()]);
    if (billingEmailError) nextErrors.billingEmail = billingEmailError;

    const phoneNoError = validate(values.phoneNo, [required()]);
    if (phoneNoError) nextErrors.phoneNo = phoneNoError;

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
    <Dialog open title={mode === "create" ? "Add Tenant" : "Edit Tenant"} onClose={onClose} maxWidth="720px">
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        {isLoadingDetail ? (
          <div className="dialog-loading">
            <Spinner size={28} />
          </div>
        ) : (
        <>
        <div className="field-row">
          <TextField
            label="Name *"
            name="name"
            value={values.name}
            error={errors.name}
            placeholder="e.g. Acme Corp"
            onChange={(e) => setField("name", e.target.value)}
          />
          <TextField
            label="Slug *"
            name="slug"
            value={values.slug}
            error={errors.slug}
            placeholder="e.g. acme-corp (lowercase & hyphens only)"
            onChange={(e) => setField("slug", e.target.value.toLowerCase())}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Plan *</label>
            <CustomSelect
              fullWidth
              label=""
              value={values.planId}
              onChange={(val) => setField("planId", val)}
              options={[
                { value: "", label: "Select a plan" },
                ...plans.map((p) => ({ value: p.id, label: p.name }))
              ]}
            />
            {errors.planId && <p className="field-error">{errors.planId}</p>}
          </div>

          <div className="field">
            <label>Industry</label>
            <CustomSelect
              fullWidth
              label=""
              value={values.industryId || ""}
              onChange={(val) => setField("industryId", val)}
              options={[
                { value: "", label: "Select an industry" },
                ...industries.map((i) => ({ value: i.id, label: i.name }))
              ]}
            />
          </div>
        </div>

        <div className="field">
          <label>Status *</label>
          <CustomSelect
            fullWidth
            label=""
            value={values.status}
            onChange={(val) => setField("status", val as TenantStatus)}
            options={Object.values(TenantStatus).map((status) => ({
              value: status,
              label: status[0].toUpperCase() + status.slice(1)
            }))}
          />
        </div>

        <TextField
          label="Tagline"
          name="tagline"
          value={values.tagline}
          onChange={(e) => setField("tagline", e.target.value)}
        />

        <div className="field-row">
          <EmailField
            label="Contact email *"
            name="contactEmail"
            value={values.contactEmail}
            error={errors.contactEmail}
            placeholder="e.g. hello@acme.com"
            onChange={(e) => setField("contactEmail", e.target.value)}
          />
          <EmailField
            label="Billing email"
            name="billingEmail"
            value={values.billingEmail}
            error={errors.billingEmail}
            placeholder="e.g. billing@acme.com"
            onChange={(e) => setField("billingEmail", e.target.value)}
          />
        </div>

        <div className="field-row">
          <PhoneField
            label="Phone *"
            name="phoneNo"
            value={values.phoneNo}
            error={errors.phoneNo}
            placeholder="555-1234"
            onChange={(val) => setField("phoneNo", val)}
          />
          <TextField
            label="Address"
            name="address"
            value={values.address}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>
        </>
        )}

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} disabled={isLoadingDetail}>
            {mode === "create" ? "Create tenant" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
