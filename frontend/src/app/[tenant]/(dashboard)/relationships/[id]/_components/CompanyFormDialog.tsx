"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AccountTier,
  CreditStatus,
  EmployeeCountBand,
  FiscalYearEndMonth,
  Region,
  RevenueBand,
  RoleBuying,
  Sector,
} from "@orelia/common";
import type {
  CompanyPickerResponse,
  CompanyResponse,
  ContactResponse,
  EmployeePickerResponse,
  IndustryResponse,
} from "@orelia/common";
import {
  createRelationshipPartyCompany,
  createRelationshipPartyContact,
  listCompanyContacts,
  updateRelationshipPartyCompany,
} from "@/lib/api/relationship-parties";
import { resolveUploadUrl, uploadLogo } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Spinner } from "@/components/ui/Spinner";
import { PlusIcon, TrashIcon, UploadCloudIcon } from "@/components/ui/icons";
import { email as emailValidator, minLength, required, validate } from "@/lib/validation";

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

const SECTOR_LABELS: Record<Sector, string> = {
  [Sector.Public]: "Public",
  [Sector.Private]: "Private",
  [Sector.Government]: "Government",
  [Sector.NonProfit]: "Non-Profit",
};

const FISCAL_YEAR_END_LABELS: Record<FiscalYearEndMonth, string> = {
  [FiscalYearEndMonth.January]: "January",
  [FiscalYearEndMonth.February]: "February",
  [FiscalYearEndMonth.March]: "March",
  [FiscalYearEndMonth.April]: "April",
  [FiscalYearEndMonth.May]: "May",
  [FiscalYearEndMonth.June]: "June",
  [FiscalYearEndMonth.July]: "July",
  [FiscalYearEndMonth.August]: "August",
  [FiscalYearEndMonth.September]: "September",
  [FiscalYearEndMonth.October]: "October",
  [FiscalYearEndMonth.November]: "November",
  [FiscalYearEndMonth.December]: "December",
};

const REGION_LABELS: Record<Region, string> = {
  [Region.NorthAmerica]: "North America",
  [Region.Europe]: "Europe",
  [Region.AsiaPacific]: "Asia Pacific",
  [Region.MiddleEast]: "Middle East",
  [Region.Africa]: "Africa",
  [Region.LatinAmerica]: "Latin America",
};

const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  [CreditStatus.Good]: "Good",
  [CreditStatus.Fair]: "Fair",
  [CreditStatus.Poor]: "Poor",
  [CreditStatus.Unknown]: "Unknown",
};

const ROLE_BUYING_LABELS: Record<RoleBuying, string> = {
  [RoleBuying.EconomicBuyer]: "Economic Buyer",
  [RoleBuying.Champion]: "Champion",
  [RoleBuying.Influencer]: "Influencer",
  [RoleBuying.Gatekeeper]: "Gatekeeper",
  [RoleBuying.EndUser]: "End User",
  [RoleBuying.Blocker]: "Blocker",
};

function withNotSet(options: { value: string; label: string }[]) {
  return [{ value: "", label: "Not set" }, ...options];
}

const ACCOUNT_TIER_OPTIONS = withNotSet(
  Object.values(AccountTier).map((value) => ({ value, label: ACCOUNT_TIER_LABELS[value] })),
);
const EMPLOYEE_COUNT_OPTIONS = withNotSet(
  Object.values(EmployeeCountBand).map((value) => ({ value, label: EMPLOYEE_COUNT_LABELS[value] })),
);
const REVENUE_BAND_OPTIONS = withNotSet(
  Object.values(RevenueBand).map((value) => ({ value, label: REVENUE_BAND_LABELS[value] })),
);
const SECTOR_OPTIONS = withNotSet(
  Object.values(Sector).map((value) => ({ value, label: SECTOR_LABELS[value] })),
);
const FISCAL_YEAR_END_OPTIONS = withNotSet(
  Object.values(FiscalYearEndMonth).map((value) => ({ value, label: FISCAL_YEAR_END_LABELS[value] })),
);
const REGION_OPTIONS = withNotSet(
  Object.values(Region).map((value) => ({ value, label: REGION_LABELS[value] })),
);
const CREDIT_STATUS_OPTIONS = withNotSet(
  Object.values(CreditStatus).map((value) => ({ value, label: CREDIT_STATUS_LABELS[value] })),
);
const ROLE_BUYING_OPTIONS = withNotSet(
  Object.values(RoleBuying).map((value) => ({ value, label: ROLE_BUYING_LABELS[value] })),
);

interface ContactRow {
  key: string;
  fullName: string;
  title: string;
  email: string;
  mobileNo: string;
  roleBuying: RoleBuying | "";
}

function newContactRow(): ContactRow {
  return { key: crypto.randomUUID(), fullName: "", title: "", email: "", mobileNo: "", roleBuying: "" };
}

interface FormState {
  name: string;
  url: string;
  logo: string;
  brands: string;
  industryId: string;
  subIndustry: string;
  accountTier: AccountTier | "";
  employeeCount: EmployeeCountBand | "";
  revenueBand: RevenueBand | "";
  annualSpend: string;
  sector: Sector | "";
  stockTicker: string;
  fiscalYearEnd: FiscalYearEndMonth | "";
  region: Region | "";
  country: string;
  hqCityAddress: string;
  branches: string;
  parentCompanyId: string;
  parentCompanyName: string;
  credit: CreditStatus | "";
  territoryOwnerId: string;
  territoryNotes: string;
}

function toFormState(company?: CompanyResponse): FormState {
  return {
    name: company?.name ?? "",
    url: company?.url ?? "",
    logo: company?.logo ?? "",
    brands: company?.brands?.join(", ") ?? "",
    industryId: company?.industryId ?? "",
    subIndustry: company?.subIndustry ?? "",
    accountTier: company?.accountTier ?? "",
    employeeCount: company?.employeeCount ?? "",
    revenueBand: company?.revenueBand ?? "",
    annualSpend: company?.annualSpend != null ? String(company.annualSpend) : "",
    sector: company?.sector ?? "",
    stockTicker: company?.stockTicker ?? "",
    fiscalYearEnd: company?.fiscalYearEnd ?? "",
    region: company?.region ?? "",
    country: company?.country ?? "",
    hqCityAddress: company?.hqCityAddress ?? "",
    branches: company?.branches?.join(", ") ?? "",
    parentCompanyId: company?.parentCompanyId ?? "",
    parentCompanyName: company?.parentCompanyName ?? "",
    credit: company?.credit ?? "",
    territoryOwnerId: company?.territoryOwnerId ?? "",
    territoryNotes: company?.territoryNotes ?? "",
  };
}

type TabId = "details" | "business" | "contacts";

interface CompanyFormDialogProps {
  mode: "create" | "edit";
  relationshipTypeId: string;
  relationshipTypeName: string;
  mapId?: string;
  company?: CompanyResponse;
  industries: IndustryResponse[];
  employees: EmployeePickerResponse[];
  companies: CompanyPickerResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function CompanyFormDialog({
  mode,
  relationshipTypeId,
  relationshipTypeName,
  mapId,
  company,
  industries,
  employees,
  companies,
  onClose,
  onSaved,
}: CompanyFormDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [values, setValues] = useState<FormState>(() => toFormState(company));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [existingContacts, setExistingContacts] = useState<ContactResponse[]>([]);
  const [isLoadingExistingContacts, setIsLoadingExistingContacts] = useState(mode === "edit");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks which new contact rows (by their stable `key`) have already been
  // successfully posted -- if row 3 of 5 fails and the user fixes it and
  // saves again, rows 1-2 must not be re-posted as duplicates.
  const savedContactKeysRef = useRef<Set<string>>(new Set());

  // Existing contacts at this company (people already saved here) are no
  // longer carried in the relationship-party list they used to piggyback
  // on -- fetched directly by companyId instead, same fix that stopped them
  // double-counting as independent top-level relationship-type entries.
  useEffect(() => {
    if (mode !== "edit" || !mapId) return;
    let cancelled = false;
    setIsLoadingExistingContacts(true);
    listCompanyContacts(relationshipTypeId, mapId)
      .then((rows) => {
        if (!cancelled) setExistingContacts(rows);
      })
      .catch(() => {
        if (!cancelled) setFormError("Failed to load this company's existing contacts");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingExistingContacts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, mapId, relationshipTypeId]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function addContact() {
    setContacts((prev) => [...prev, newContactRow()]);
  }

  function updateContact<K extends keyof ContactRow>(key: string, field: K, value: ContactRow[K]) {
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  function removeContact(key: string) {
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError(null);
    setIsUploadingLogo(true);
    try {
      const { url } = await uploadLogo(file);
      setField("logo", url);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.name, [required(), minLength(1)]);
    if (nameError) nextErrors.name = nameError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setActiveTab("details");
      return false;
    }
    return true;
  }

  function toListOrUndefined(csv: string): string[] | undefined {
    const items = csv.split(",").map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      if (mode === "create") {
        // Company and every filled-in contact row are sent together and
        // created in one backend transaction -- either all of it lands, or
        // none of it does.
        await createRelationshipPartyCompany(relationshipTypeId, {
          name: values.name.trim(),
          url: values.url.trim() || undefined,
          logo: values.logo.trim() || undefined,
          brands: toListOrUndefined(values.brands),
          industryId: values.industryId || undefined,
          subIndustry: values.subIndustry.trim() || undefined,
          accountTier: values.accountTier || undefined,
          employeeCount: values.employeeCount || undefined,
          revenueBand: values.revenueBand || undefined,
          annualSpend: values.annualSpend.trim() ? Number(values.annualSpend) : undefined,
          sector: values.sector || undefined,
          stockTicker: values.stockTicker.trim() || undefined,
          fiscalYearEnd: values.fiscalYearEnd || undefined,
          region: values.region || undefined,
          country: values.country.trim() || undefined,
          hqCityAddress: values.hqCityAddress.trim() || undefined,
          branches: toListOrUndefined(values.branches),
          parentCompanyId: values.parentCompanyId || undefined,
          parentCompanyName: values.parentCompanyId ? undefined : values.parentCompanyName.trim() || undefined,
          credit: values.credit || undefined,
          territoryOwnerId: values.territoryOwnerId || undefined,
          territoryNotes: values.territoryNotes.trim() || undefined,
          contacts: contacts
            .filter((contact) => contact.fullName.trim())
            .map((contact) => ({
              fullName: contact.fullName.trim(),
              title: contact.title.trim() || undefined,
              email: contact.email.trim() || undefined,
              mobileNo: contact.mobileNo.trim() || undefined,
              roleBuying: contact.roleBuying || undefined,
            })),
        });
      } else {
        // PATCH semantics: omitted keys are left untouched, so every field
        // must be sent with its real current value (or null to clear an
        // enum) rather than undefined, or a clear would silently no-op.
        await updateRelationshipPartyCompany(relationshipTypeId, mapId!, {
          name: values.name.trim(),
          url: values.url.trim(),
          logo: values.logo.trim(),
          brands: toListOrUndefined(values.brands) ?? [],
          industryId: values.industryId || undefined,
          subIndustry: values.subIndustry.trim(),
          accountTier: values.accountTier || null,
          employeeCount: values.employeeCount || null,
          revenueBand: values.revenueBand || null,
          annualSpend: values.annualSpend.trim() ? Number(values.annualSpend) : null,
          sector: values.sector || null,
          stockTicker: values.stockTicker.trim(),
          fiscalYearEnd: values.fiscalYearEnd || null,
          region: values.region || null,
          country: values.country.trim(),
          hqCityAddress: values.hqCityAddress.trim(),
          branches: toListOrUndefined(values.branches) ?? [],
          parentCompanyId: values.parentCompanyId || null,
          // null (not undefined) when a real parentCompanyId is set --
          // JSON.stringify drops undefined keys entirely, which meant this
          // never actually cleared server-side after switching from a
          // free-text parent name to a linked one (the two are meant to be
          // mutually exclusive, per company.entity.ts's own comment).
          parentCompanyName: values.parentCompanyId ? null : values.parentCompanyName.trim(),
          credit: values.credit || null,
          territoryOwnerId: values.territoryOwnerId || null,
          territoryNotes: values.territoryNotes.trim(),
        });

        // Contacts added here are new additions to an existing company --
        // existing contacts already show as their own rows and are edited there.
        for (const contact of contacts) {
          if (!contact.fullName.trim()) continue;
          if (savedContactKeysRef.current.has(contact.key)) continue;
          await createRelationshipPartyContact(relationshipTypeId, {
            companyId: company?.id,
            fullName: contact.fullName.trim(),
            title: contact.title.trim() || undefined,
            email: contact.email.trim() || undefined,
            mobileNo: contact.mobileNo.trim() || undefined,
            roleBuying: contact.roleBuying || undefined,
          });
          savedContactKeysRef.current.add(contact.key);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save company");
    } finally {
      setIsSaving(false);
    }
  }

  const industryOptions = withNotSet(industries.map((i) => ({ value: i.id, label: i.name })));
  const employeeOptions = withNotSet(employees.map((e) => ({ value: e.id, label: e.fullName })));
  const parentCompanyOptions = withNotSet(
    companies.filter((c) => c.id !== company?.id).map((c) => ({ value: c.id, label: c.name })),
  );

  return (
    <Dialog
      open
      title={mode === "create" ? `Add Company (${relationshipTypeName})` : "Edit Company"}
      onClose={onClose}
      maxWidth="720px"
    >
      <form onSubmit={handleSubmit}>
        <div className="dialog-tabs">
          <button
            type="button"
            className={`dialog-tab${activeTab === "details" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Company Details
          </button>
          <button
            type="button"
            className={`dialog-tab${activeTab === "business" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("business")}
          >
            Business Details
          </button>
          <button
            type="button"
            className={`dialog-tab${activeTab === "contacts" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("contacts")}
          >
            Contacts{contacts.length + existingContacts.length > 0 ? ` (${contacts.length + existingContacts.length})` : ""}
          </button>
        </div>

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        {/* ── Tab 1: Company Details ─────────────────────── */}
        {activeTab === "details" && (
          <div>
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

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Industry</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.industryId}
                  onChange={(val) => setField("industryId", val)}
                  options={industryOptions}
                />
              </div>
              <TextField
                label="Sub-industry"
                name="subIndustry"
                value={values.subIndustry}
                onChange={(e) => setField("subIndustry", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Sector</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.sector}
                  onChange={(val) => setField("sector", val as Sector | "")}
                  options={SECTOR_OPTIONS}
                />
              </div>
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Account tier</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.accountTier}
                  onChange={(val) => setField("accountTier", val as AccountTier | "")}
                  options={ACCOUNT_TIER_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Employee count</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.employeeCount}
                  onChange={(val) => setField("employeeCount", val as EmployeeCountBand | "")}
                  options={EMPLOYEE_COUNT_OPTIONS}
                />
              </div>
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Revenue band</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.revenueBand}
                  onChange={(val) => setField("revenueBand", val as RevenueBand | "")}
                  options={REVENUE_BAND_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
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
            </div>
          </div>
        )}

        {/* ── Tab 2: Business Details ────────────────────── */}
        {activeTab === "business" && (
          <div>
            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Logo</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {values.logo && (
                  <img
                    src={resolveUploadUrl(values.logo)}
                    alt="Company logo"
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid var(--color-border)" }}
                  />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={isUploadingLogo}
                >
                  <UploadCloudIcon size={14} /> {values.logo ? "Replace logo" : "Upload logo"}
                </Button>
                {values.logo && (
                  <Button type="button" variant="secondary" onClick={() => setField("logo", "")}>
                    Remove
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  hidden
                  onChange={handleLogoChange}
                />
              </div>
            </div>

            <TextField
              label="Brands (comma-separated)"
              name="brands"
              value={values.brands}
              placeholder="e.g. Acme, AcmePro"
              onChange={(e) => setField("brands", e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3.5">
              <TextField
                label="Stock ticker"
                name="stockTicker"
                value={values.stockTicker}
                onChange={(e) => setField("stockTicker", e.target.value)}
              />
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Fiscal year end</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.fiscalYearEnd}
                  onChange={(val) => setField("fiscalYearEnd", val as FiscalYearEndMonth | "")}
                  options={FISCAL_YEAR_END_OPTIONS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Region</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.region}
                  onChange={(val) => setField("region", val as Region | "")}
                  options={REGION_OPTIONS}
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
            </div>

            <TextField
              label="Branches (comma-separated)"
              name="branches"
              value={values.branches}
              placeholder="e.g. Singapore, London"
              onChange={(e) => setField("branches", e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Parent company (existing)</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.parentCompanyId}
                  onChange={(val) => setField("parentCompanyId", val)}
                  options={parentCompanyOptions}
                />
              </div>
              <TextField
                label="Or parent company name (if not listed)"
                name="parentCompanyName"
                value={values.parentCompanyName}
                disabled={!!values.parentCompanyId}
                placeholder="e.g. Acme Holdings"
                onChange={(e) => setField("parentCompanyName", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Credit status</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.credit}
                  onChange={(val) => setField("credit", val as CreditStatus | "")}
                  options={CREDIT_STATUS_OPTIONS}
                />
              </div>
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Territory owner</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.territoryOwnerId}
                  onChange={(val) => setField("territoryOwnerId", val)}
                  options={employeeOptions}
                />
              </div>
            </div>

            <div className="mb-[18px]">
              <label htmlFor="territoryNotes" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Territory notes</label>
              <textarea
                id="territoryNotes"
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 font-[inherit] text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)] focus:outline-none"
                rows={3}
                value={values.territoryNotes}
                placeholder="Any additional context about this account's territory..."
                onChange={(e) => setField("territoryNotes", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Tab 3: Contacts ─────────────────────────────── */}
        {activeTab === "contacts" && (
          <div>
            {mode === "edit" && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontWeight: 600, marginBottom: "8px" }}>Existing contacts</p>
                {isLoadingExistingContacts ? (
                  <Spinner size={20} />
                ) : existingContacts.length === 0 ? (
                  <p className="deal-empty-tab">No contacts added yet.</p>
                ) : (
                  <>
                    {existingContacts.map((existing) => (
                      <div key={existing.id} className="deal-contact-row">
                        <div className="deal-contact-fields">
                          <div className="field-row">
                            <div className="field">
                              <label>Full name</label>
                              <p>{existing.fullName}</p>
                            </div>
                            <div className="field">
                              <label>Title</label>
                              <p>{existing.title || "—"}</p>
                            </div>
                          </div>
                          <div className="field-row">
                            <div className="field">
                              <label>Email</label>
                              <p>{existing.email || "—"}</p>
                            </div>
                            <div className="field">
                              <label>Mobile number</label>
                              <p>{existing.mobileNo || "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                      Editing or removing an existing contact isn't available here yet — add a
                      replacement below if their details changed.
                    </p>
                  </>
                )}
              </div>
            )}

            {contacts.length === 0 && (
              <p className="deal-empty-tab">
                {mode === "edit" ? "No new contacts to add." : "No contacts added yet. Add one or more people at this company below."}
              </p>
            )}

            {contacts.map((contact) => {
              const emailError = contact.email ? validate(contact.email, [emailValidator()]) : undefined;
              return (
                <div key={contact.key} className="deal-contact-row">
                  <div className="deal-contact-fields">
                    <div className="grid grid-cols-2 gap-3.5">
                      <TextField
                        label="Full name"
                        value={contact.fullName}
                        placeholder="e.g. Jane Doe"
                        onChange={(e) => updateContact(contact.key, "fullName", e.target.value)}
                      />
                      <TextField
                        label="Title"
                        value={contact.title}
                        placeholder="e.g. Procurement Lead"
                        onChange={(e) => updateContact(contact.key, "title", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                      <TextField
                        label="Email"
                        type="email"
                        value={contact.email}
                        error={emailError}
                        placeholder="name@company.com"
                        onChange={(e) => updateContact(contact.key, "email", e.target.value)}
                      />
                      <TextField
                        label="Mobile number"
                        value={contact.mobileNo}
                        onChange={(e) => updateContact(contact.key, "mobileNo", e.target.value)}
                      />
                    </div>
                    <div className="mb-[18px]">
                      <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Buying role</label>
                      <CustomSelect
                        fullWidth
                        label=""
                        value={contact.roleBuying}
                        onChange={(val) => updateContact(contact.key, "roleBuying", val as RoleBuying | "")}
                        options={ROLE_BUYING_OPTIONS}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="deal-contact-remove"
                    aria-label="Remove contact"
                    onClick={() => removeContact(contact.key)}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              );
            })}

            <Button type="button" variant="secondary" className="btn-add" onClick={addContact}>
              <PlusIcon size={14} /> Add contact
            </Button>
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2.5">
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