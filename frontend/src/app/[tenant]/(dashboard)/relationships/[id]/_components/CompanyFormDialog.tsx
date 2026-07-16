"use client";

import { useState, type FormEvent } from "react";
import { AccountTier, EmployeeCountBand, RevenueBand } from "@orelia/common";
import type { CompanyResponse } from "@orelia/common";
import {
  createRelationshipPartyCompany,
  updateRelationshipPartyCompany,
} from "@/lib/api/relationship-parties";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { minLength, required, validate } from "@/lib/validation";

const ACCOUNT_TIER_LABELS: Record<AccountTier, string> = {
  [AccountTier.Strategic]: "Strategic",
  [AccountTier.Enterprise]: "Enterprise",
  [AccountTier.MidMarket]: "Mid-Market",
  [AccountTier.Smb]: "SMB",
};

const EMPLOYEE_COUNT_LABELS: Record<EmployeeCountBand, string> = {
  [EmployeeCountBand.Range1To10]: "1–10",
  [EmployeeCountBand.Range11To50]: "11–50",
  [EmployeeCountBand.Range51To200]: "51–200",
  [EmployeeCountBand.Range201To1000]: "201–1,000",
  [EmployeeCountBand.Range1000Plus]: "1,000+",
};

const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  [RevenueBand.Under1M]: "Under $1M",
  [RevenueBand.Range1MTo10M]: "$1M–$10M",
  [RevenueBand.Range10MTo50M]: "$10M–$50M",
  [RevenueBand.Range50MTo250M]: "$50M–$250M",
  [RevenueBand.Over250M]: "Over $250M",
};

const ACCOUNT_TIER_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(AccountTier).map((value) => ({ value, label: ACCOUNT_TIER_LABELS[value] })),
];
const EMPLOYEE_COUNT_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(EmployeeCountBand).map((value) => ({ value, label: EMPLOYEE_COUNT_LABELS[value] })),
];
const REVENUE_BAND_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(RevenueBand).map((value) => ({ value, label: REVENUE_BAND_LABELS[value] })),
];

interface FormState {
  name: string;
  url: string;
  logo: string;
  subIndustry: string;
  accountTier: AccountTier | "";
  employeeCount: EmployeeCountBand | "";
  revenueBand: RevenueBand | "";
  annualSpend: string;
  country: string;
  hqCityAddress: string;
}

function toFormState(company?: CompanyResponse): FormState {
  return {
    name: company?.name ?? "",
    url: company?.url ?? "",
    logo: company?.logo ?? "",
    subIndustry: company?.subIndustry ?? "",
    accountTier: company?.accountTier ?? "",
    employeeCount: company?.employeeCount ?? "",
    revenueBand: company?.revenueBand ?? "",
    annualSpend: company?.annualSpend != null ? String(company.annualSpend) : "",
    country: company?.country ?? "",
    hqCityAddress: company?.hqCityAddress ?? "",
  };
}

interface CompanyFormDialogProps {
  mode: "create" | "edit";
  relationshipTypeId: string;
  relationshipTypeName: string;
  mapId?: string;
  company?: CompanyResponse;
  onClose: () => void;
  onSaved: () => void;
}

export function CompanyFormDialog({
  mode,
  relationshipTypeId,
  relationshipTypeName,
  mapId,
  company,
  onClose,
  onSaved,
}: CompanyFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(company));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.name, [required(), minLength(1)]);
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
      if (mode === "create") {
        await createRelationshipPartyCompany(relationshipTypeId, {
          name: values.name.trim(),
          url: values.url.trim() || undefined,
          logo: values.logo.trim() || undefined,
          subIndustry: values.subIndustry.trim() || undefined,
          accountTier: values.accountTier || undefined,
          employeeCount: values.employeeCount || undefined,
          revenueBand: values.revenueBand || undefined,
          annualSpend: values.annualSpend.trim() ? Number(values.annualSpend) : undefined,
          country: values.country.trim() || undefined,
          hqCityAddress: values.hqCityAddress.trim() || undefined,
        });
      } else {
        // PATCH semantics: omitted keys are left untouched, so every field
        // must be sent with its real current value (or null to clear an
        // enum) rather than undefined, or a clear would silently no-op.
        await updateRelationshipPartyCompany(relationshipTypeId, mapId!, {
          name: values.name.trim(),
          url: values.url.trim(),
          logo: values.logo.trim(),
          subIndustry: values.subIndustry.trim(),
          accountTier: values.accountTier || null,
          employeeCount: values.employeeCount || null,
          revenueBand: values.revenueBand || null,
          annualSpend: values.annualSpend.trim() ? Number(values.annualSpend) : null,
          country: values.country.trim(),
          hqCityAddress: values.hqCityAddress.trim(),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save company");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      title={mode === "create" ? `Add Company (${relationshipTypeName})` : "Edit Company"}
      onClose={onClose}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="field-error">{formError}</p>}

        <TextField
          label="Company name *"
          name="name"
          value={values.name}
          error={errors.name}
          placeholder="e.g. Acme Corp"
          onChange={(e) => setField("name", e.target.value)}
        />

        <TextField
          label="Website"
          name="url"
          value={values.url}
          placeholder="https://example.com"
          onChange={(e) => setField("url", e.target.value)}
        />

        <TextField
          label="Logo URL"
          name="logo"
          value={values.logo}
          onChange={(e) => setField("logo", e.target.value)}
        />

        <TextField
          label="Sub-industry"
          name="subIndustry"
          value={values.subIndustry}
          onChange={(e) => setField("subIndustry", e.target.value)}
        />

        <div className="field">
          <label>Account tier</label>
          <CustomSelect
            fullWidth
            label=""
            value={values.accountTier}
            onChange={(val) => setField("accountTier", val as AccountTier | "")}
            options={ACCOUNT_TIER_OPTIONS}
          />
        </div>

        <div className="field">
          <label>Employee count</label>
          <CustomSelect
            fullWidth
            label=""
            value={values.employeeCount}
            onChange={(val) => setField("employeeCount", val as EmployeeCountBand | "")}
            options={EMPLOYEE_COUNT_OPTIONS}
          />
        </div>

        <div className="field">
          <label>Revenue band</label>
          <CustomSelect
            fullWidth
            label=""
            value={values.revenueBand}
            onChange={(val) => setField("revenueBand", val as RevenueBand | "")}
            options={REVENUE_BAND_OPTIONS}
          />
        </div>

        <TextField
          label="Annual spend (USD)"
          name="annualSpend"
          type="number"
          min="0"
          step="0.01"
          value={values.annualSpend}
          onChange={(e) => setField("annualSpend", e.target.value)}
        />

        <TextField
          label="Country"
          name="country"
          value={values.country}
          onChange={(e) => setField("country", e.target.value)}
        />

        <TextField
          label="HQ address"
          name="hqCityAddress"
          value={values.hqCityAddress}
          onChange={(e) => setField("hqCityAddress", e.target.value)}
        />

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {mode === "create" ? "Create company" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
