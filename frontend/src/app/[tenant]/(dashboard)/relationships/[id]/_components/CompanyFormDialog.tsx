"use client";

import { useEffect, useRef, useState, type FormEvent, Fragment } from "react";
import {
  AccountTier,
  CreditStatus,
  EmployeeCountBand,
  FiscalYearEndMonth,
  Region,
  RevenueBand,
  Sector,
} from "@orelia/common";
import type {
  CompanyPickerResponse,
  CompanyResponse,
  ContactResponse,
  EmployeePickerResponse,
  IndustryResponse,
  RelationshipTagResponse,
  RelationshipTypePickerResponse,
} from "@orelia/common";
import {
  addCompanyTag,
  createRelationshipPartyCompany,
  createRelationshipPartyContact,
  deleteCompanyContact,
  listCompanyContacts,
  listCompanyTags,
  updateRelationshipPartyCompany,
} from "@/lib/api/relationship-parties";
import { listRelationshipTypesPicker } from "@/lib/api/pickers";
import { uploadLogo } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CountryMultiSelect } from "@/components/ui/CountryMultiSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { RelationshipHubDiagram } from "@/components/ui/RelationshipHubDiagram";
import { Spinner } from "@/components/ui/Spinner";
import { BuildingIcon, EditIcon, PlusIcon, TrashIcon, UploadCloudIcon, UserIcon } from "@/components/ui/icons";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { min, minLength, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";
import { ContactFields, type ContactFieldsValue, ROLE_BUYING_LABELS } from "./ContactFields";
import { ContactFormDialog } from "./ContactFormDialog";

const ACCOUNT_TIER_LABELS: Record<AccountTier, string> = {
  [AccountTier.Strategic]: "Strategic",
  [AccountTier.Enterprise]: "Enterprise",
  [AccountTier.MidMarket]: "Mid-Market",
  [AccountTier.Smb]: "SMB",
  [AccountTier.Government]: "Government",
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
interface ContactRow extends ContactFieldsValue {
  key: string;
}

function newContactRow(): ContactRow {
  return {
    key: crypto.randomUUID(),
    fullName: "",
    title: "",
    department: "",
    roleBuying: "",
    email: "",
    mobileNo: "",
    directPhoneNo: "",
    linkedIn: "",
    country: "",
    timezone: "",
  };
}

interface FormState {
  name: string;
  url: string;
  logo: string;
  brands: string;
  // Arrays, not the comma-joined strings brands/branches use -- these are
  // picker-driven (a fixed option list), so free-text parsing has nothing to do.
  industryIds: string[];
  subIndustry: string;
  accountTier: AccountTier | "";
  employeeCount: EmployeeCountBand | "";
  revenueBand: RevenueBand | "";
  annualSpend: string;
  sector: Sector | "";
  stockTicker: string;
  fiscalYearEnd: FiscalYearEndMonth | "";
  region: Region | "";
  countries: string[];
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
    industryIds: company?.industryIds ?? [],
    subIndustry: company?.subIndustry ?? "",
    accountTier: company?.accountTier ?? "",
    employeeCount: company?.employeeCount ?? "",
    revenueBand: company?.revenueBand ?? "",
    annualSpend: company?.annualSpend != null ? String(company.annualSpend) : "",
    sector: company?.sector ?? "",
    stockTicker: company?.stockTicker ?? "",
    fiscalYearEnd: company?.fiscalYearEnd ?? "",
    region: company?.region ?? "",
    countries: company?.countries ?? [],
    hqCityAddress: company?.hqCityAddress ?? "",
    branches: company?.branches?.join(", ") ?? "",
    parentCompanyId: company?.parentCompanyId ?? "",
    parentCompanyName: company?.parentCompanyName ?? "",
    credit: company?.credit ?? "",
    territoryOwnerId: company?.territoryOwnerId ?? "",
    territoryNotes: company?.territoryNotes ?? "",
  };
}

type TabId = "details" | "business" | "contacts" | "relationships";

interface CompanyFormDialogProps {
  mode: "create" | "edit" | "view";
  relationshipTypeId: string;
  relationshipTypeName: string;
  mapId?: string;
  company?: CompanyResponse;
  industries: IndustryResponse[];
  employees: EmployeePickerResponse[];
  companies: CompanyPickerResponse[];
  // Gates Edit/Delete on the "Existing contacts" list -- this dialog took no
  // permission props at all before; RelationshipViewWidget.tsx's own
  // canUpdate/canDelete (RELATIONSHIP_UPDATE/RELATIONSHIP_DELETE) thread
  // straight through, same permissions as everything else in this dialog.
  canUpdate?: boolean;
  canDelete?: boolean;
  // Gates the "add a relationship type tag" picker on the Relationships tab
  // (RELATIONSHIP_CREATE) -- separate from canUpdate/canDelete above since
  // tagging is its own permission, not an update to the company's own fields.
  canCreate?: boolean;
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
  canUpdate = false,
  canDelete = false,
  canCreate = false,
  onClose,
  onSaved,
}: CompanyFormDialogProps) {
  const isViewOnly = mode === "view";
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [values, setValues] = useState<FormState>(() => toFormState(company));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [existingContacts, setExistingContacts] = useState<ContactResponse[]>([]);
  const [isLoadingExistingContacts, setIsLoadingExistingContacts] = useState(mode !== "create");
  const [editingExistingContact, setEditingExistingContact] = useState<ContactResponse | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [expandedContactKeys, setExpandedContactKeys] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  // values.logo is the stable S3 key that actually gets saved -- logos are
  // private objects, so there's no permanent URL to render directly. This
  // holds whichever signed URL is current for preview: the freshly-uploaded
  // one this session, or (on edit) the one the server already resolved for
  // the existing logo. Never itself persisted anywhere.
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(company?.logoDisplayUrl ?? null);
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
    if (mode === "create" || !mapId) return;
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

  // Relationships tab -- cross-relationship-type tags for this company (see
  // relationship-tags.controller.ts). Keyed by company.id (the real Company
  // id), not mapId (this relationship type's own party row id), since a
  // company's tags span every relationship type it's tagged under.
  const [tags, setTags] = useState<RelationshipTagResponse[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(mode !== "create");
  const [relationshipTypeOptions, setRelationshipTypeOptions] = useState<RelationshipTypePickerResponse[]>([]);
  const [selectedTagTypeId, setSelectedTagTypeId] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create" || !company) return;
    let cancelled = false;
    setIsLoadingTags(true);
    listCompanyTags(company.id)
      .then((rows) => {
        if (!cancelled) setTags(rows);
      })
      .catch(() => {
        if (!cancelled) setTagError(t("relationshipTags.errors.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTags(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, company]);

  // Only fetched when the add-tag picker can actually be used -- edit mode,
  // with create permission on this resource. Uses the dedicated
  // /pickers/relationship-types route (gated on RELATIONSHIP_* -- the
  // consumer's own permission), not the full admin GET /relationship-types
  // (gated on RELATIONSHIP_TYPE_*) -- a RELATIONSHIP_CREATE holder with no
  // Relationship-Type admin rights would otherwise 403 here silently
  // (found in review).
  useEffect(() => {
    if (mode !== "edit" || !canCreate) return;
    let cancelled = false;
    listRelationshipTypesPicker()
      .then((rows) => {
        if (!cancelled) setRelationshipTypeOptions(rows);
      })
      .catch(() => {
        // Surfaced (not swallowed) -- otherwise a fetch failure looks
        // identical to "every relationship type is already tagged"
        // (found in review).
        if (!cancelled) setTagError(t("relationshipTags.errors.loadTypesFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, canCreate]);

  async function refreshTags() {
    if (!company) return;
    try {
      const rows = await listCompanyTags(company.id);
      setTags(rows);
    } catch {
      // Non-fatal -- the just-added tag already succeeded; the list will
      // catch up next time this dialog opens.
    }
  }

  async function handleAddTag() {
    if (!company || !selectedTagTypeId) return;
    setTagError(null);
    setIsAddingTag(true);
    try {
      await addCompanyTag(company.id, { relationshipTypeId: selectedTagTypeId });
      setSelectedTagTypeId("");
      await refreshTags();
    } catch (err) {
      if (err instanceof ApiError) {
        setTagError(err.status === 409 ? t("relationshipTags.errors.duplicateTag") : err.message);
      } else {
        setTagError(t("relationshipTags.errors.addFailed"));
      }
    } finally {
      setIsAddingTag(false);
    }
  }

  const confirm = useConfirm();
  const { showError } = useAlert();

  async function refreshExistingContacts() {
    if (!mapId) return;
    try {
      const rows = await listCompanyContacts(relationshipTypeId, mapId);
      setExistingContacts(rows);
    } catch {
      // Non-fatal -- the saved change already succeeded; the list will
      // catch up next time this dialog opens.
    }
  }

  async function handleDeleteExistingContact(existing: ContactResponse) {
    if (!mapId) return;
    const ok = await confirm({
      title: "Delete Contact",
      message: `Are you sure you want to delete "${existing.fullName}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingContactId(existing.id);
    try {
      await deleteCompanyContact(relationshipTypeId, mapId, existing.id);
      setExistingContacts((current) => current.filter((c) => c.id !== existing.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete contact");
    } finally {
      setDeletingContactId(null);
    }
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function addContact() {
    const row = newContactRow();
    setContacts((prev) => [...prev, row]);
    setExpandedContactKeys((prev) => new Set(prev).add(row.key));
  }

  function toggleContactExpand(key: string) {
    setExpandedContactKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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
      const { key, previewUrl } = await uploadLogo(file, values.name);
      setField("logo", key);
      setLogoPreviewUrl(previewUrl);
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
    const annualSpendError = validate(values.annualSpend, [min(0, "Annual spend can't be negative")]);
    if (annualSpendError) nextErrors.annualSpend = annualSpendError;
    setErrors(nextErrors);
    if (nextErrors.name) {
      setActiveTab("details");
      return false;
    }
    if (nextErrors.annualSpend) {
      setActiveTab("business");
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
          industryIds: values.industryIds.length ? values.industryIds : undefined,
          subIndustry: values.subIndustry.trim() || undefined,
          accountTier: values.accountTier || undefined,
          employeeCount: values.employeeCount || undefined,
          revenueBand: values.revenueBand || undefined,
          annualSpend: values.annualSpend.trim() ? Number(values.annualSpend) : undefined,
          sector: values.sector || undefined,
          stockTicker: values.stockTicker.trim() || undefined,
          fiscalYearEnd: values.fiscalYearEnd || undefined,
          region: values.region || undefined,
          countries: values.countries.length ? values.countries : undefined,
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
              department: contact.department.trim() || undefined,
              roleBuying: contact.roleBuying || undefined,
              email: contact.email.trim() || undefined,
              mobileNo: contact.mobileNo.trim() || undefined,
              directPhoneNo: contact.directPhoneNo.trim() || undefined,
              linkedIn: contact.linkedIn.trim() || undefined,
              country: contact.country.trim() || undefined,
              timezone: contact.timezone.trim() || undefined,
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
          // Always sent, never undefined -- an emptied picker has to reach the
          // server as [] to actually clear the links. Omitting the key means
          // "leave untouched" server-side, which would silently ignore a
          // deliberate clear (the same trap parentCompanyName hit below).
          industryIds: values.industryIds,
          subIndustry: values.subIndustry.trim(),
          accountTier: values.accountTier || null,
          employeeCount: values.employeeCount || null,
          revenueBand: values.revenueBand || null,
          annualSpend: values.annualSpend.trim() ? Number(values.annualSpend) : null,
          sector: values.sector || null,
          stockTicker: values.stockTicker.trim(),
          fiscalYearEnd: values.fiscalYearEnd || null,
          region: values.region || null,
          // Always sent for the same reason as industryIds above.
          countries: values.countries,
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
            department: contact.department.trim() || undefined,
            roleBuying: contact.roleBuying || undefined,
            email: contact.email.trim() || undefined,
            mobileNo: contact.mobileNo.trim() || undefined,
            directPhoneNo: contact.directPhoneNo.trim() || undefined,
            linkedIn: contact.linkedIn.trim() || undefined,
            country: contact.country.trim() || undefined,
            timezone: contact.timezone.trim() || undefined,
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

  // No withNotSet() here, unlike the single-select fields below: a multi-select
  // expresses "not set" as an empty chip list, and a literal "Not set" option
  // would be selectable as a chip alongside real industries.
  const industryOptions = industries.map((i) => ({ value: i.id, label: i.name }));
  const employeeOptions = withNotSet(employees.map((e) => ({ value: e.id, label: e.fullName })));
  // The employees picker excludes exited (terminated/resigned) staff. When
  // editing a company whose territory owner has since exited, they're no longer
  // in the list -- re-append them from the company's resolved name so the field
  // keeps its current value instead of silently blanking on save. (Same pattern
  // as AddDealDialog's Sales Person / Pre-Sales / PMO handling.)
  if (company?.territoryOwnerId && !employeeOptions.some((o) => o.value === company.territoryOwnerId)) {
    employeeOptions.push({ value: company.territoryOwnerId, label: company.territoryOwnerName ?? "Unknown" });
  }
  const parentCompanyOptions = withNotSet(
    companies.filter((c) => c.id !== company?.id).map((c) => ({ value: c.id, label: c.name })),
  );

  const tagSpokes = tags.map((tag) => ({ id: tag.mapId, label: tag.relationshipTypeName, isActive: tag.isActive }));
  // Only ACTIVE tags block re-selection -- found in review: filtering on
  // every tag (including disabled ones) made a disabled tag's type
  // permanently unselectable here, so the backend's reactivate-via-setActive
  // path was never actually reachable from this picker.
  const taggedTypeIds = new Set(tags.filter((tag) => tag.isActive).map((tag) => tag.relationshipTypeId));
  const addTagOptions = relationshipTypeOptions
    .filter((type) => !taggedTypeIds.has(type.id))
    .map((type) => ({ value: type.id, label: type.name }));

  return (
    <Dialog
      open
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-crm-primary">
            <BuildingIcon size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-crm-text">
              {mode === "create"
                ? `Add Company (${relationshipTypeName})`
                : mode === "view"
                  ? "View Company"
                  : "Edit Company"}
            </span>
            {mode !== "create" && company && (
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
                {company.name}
              </span>
            )}
          </div>
        </div>
      }
      onClose={onClose}
      maxWidth="720px"
    >
      <form onSubmit={handleSubmit}>
        <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl mb-6 select-none border border-slate-200/40 shadow-sm">
          {(() => {
            const tabsOrder = mode === "create"
              ? ["details", "business", "contacts"]
              : ["details", "business", "contacts", "relationships"];
            
            return tabsOrder.map((tabId, idx) => {
              const isActive = activeTab === tabId;
              const showDivider = idx > 0 && !isActive && activeTab !== tabsOrder[idx - 1];
              
              let label = "";
              let icon = null;
              if (tabId === "details") {
                label = "Details";
                icon = <BuildingIcon size={14} />;
              } else if (tabId === "business") {
                label = "Business";
                icon = (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                );
              } else if (tabId === "contacts") {
                label = "Contacts";
                icon = <UserIcon size={14} />;
              } else if (tabId === "relationships") {
                label = t("relationshipTags.tabLabel");
                icon = (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                );
              }
              
              let clipPath = "";
              if (isActive) {
                const isFirst = idx === 0;
                const isLast = idx === tabsOrder.length - 1;
                if (isFirst) {
                  clipPath = "polygon(0 0, 100% 0, 88% 100%, 0 100%)";
                } else if (isLast) {
                  clipPath = "polygon(12% 0, 100% 0, 100% 100%, 0 100%)";
                } else {
                  clipPath = "polygon(12% 0, 100% 0, 88% 100%, 0 100%)";
                }
              }

              return (
                <Fragment key={tabId}>
                  {showDivider && <div className="w-px h-3.5 bg-slate-300/80 mx-1" />}
                  <button
                    type="button"
                    onClick={() => setActiveTab(tabId as never)}
                    className={`relative flex items-center gap-2 py-2 px-5 font-bold transition-all duration-150 border-none outline-none focus:outline-none cursor-pointer ${
                      isActive
                        ? "text-white select-none"
                        : "text-slate-550 hover:bg-slate-200/50 hover:text-slate-800 rounded-lg"
                    }`}
                  >
                    {isActive && (
                      <div 
                        className={`absolute inset-0 bg-crm-primary shadow-sm ${
                          idx === 0 ? "rounded-l-lg" : idx === tabsOrder.length - 1 ? "rounded-r-lg" : ""
                        }`}
                        style={{ clipPath }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2 text-[13px]">
                      {icon}
                      {label}
                    </span>
                  </button>
                </Fragment>
              );
            });
          })()}
        </div>

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        {/* ── Tab 1: Company Details ─────────────────────── */}
        {activeTab === "details" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
            {/* Card 1: Primary Identity */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Identity & Web</span>
              </div>
              <div className="space-y-1">
                <TextField
                  label="Company name *"
                  name="name"
                  value={values.name}
                  error={errors.name}
                  placeholder="e.g. Acme Corp"
                  disabled={isViewOnly}
                  onChange={(e) => setField("name", e.target.value)}
                />

                <TextField
                  label="Website"
                  name="url"
                  value={values.url}
                  placeholder="https://example.com"
                  disabled={isViewOnly}
                  onChange={(e) => setField("url", e.target.value)}
                />
              </div>
            </div>

            {/* Card 2: Classification */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Classification</span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="mb-[18px]">
                    <MultiSelect
                      label={t("companyForm.industries.label")}
                      values={values.industryIds}
                      onChange={(vals) => setField("industryIds", vals)}
                      options={industryOptions}
                      placeholder={t("companyForm.industries.placeholder")}
                      searchPlaceholder={t("companyForm.industries.searchPlaceholder")}
                      disabled={isViewOnly}
                    />
                  </div>
                  <TextField
                    label="Sub-industry"
                    name="subIndustry"
                    value={values.subIndustry}
                    disabled={isViewOnly}
                    onChange={(e) => setField("subIndustry", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="mb-[18px]">
                    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Sector</label>
                    <CustomSelect
                      fullWidth
                      label=""
                      value={values.sector}
                      onChange={(val) => setField("sector", val as Sector | "")}
                      options={SECTOR_OPTIONS}
                      disabled={isViewOnly}
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
                      disabled={isViewOnly}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Firmographics & Geography */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Scale & Geography</span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="mb-[18px]">
                    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Employee count</label>
                    <CustomSelect
                      fullWidth
                      label=""
                      value={values.employeeCount}
                      onChange={(val) => setField("employeeCount", val as EmployeeCountBand | "")}
                      options={EMPLOYEE_COUNT_OPTIONS}
                      disabled={isViewOnly}
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
                      disabled={isViewOnly}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <CountryMultiSelect
                    label={t("companyForm.countries.label")}
                    values={values.countries}
                    onChange={(vals) => setField("countries", vals)}
                    placeholder={t("companyForm.countries.placeholder")}
                    searchPlaceholder={t("companyForm.countries.searchPlaceholder")}
                    disabled={isViewOnly}
                  />
                  <TextField
                    label="HQ address"
                    name="hqCityAddress"
                    value={values.hqCityAddress}
                    disabled={isViewOnly}
                    onChange={(e) => setField("hqCityAddress", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Business Details ────────────────────── */}
        {activeTab === "business" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
            {/* Card 1: Visual Identity */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Visual Identity</span>
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-[13px] font-semibold text-[var(--color-text-muted)]">Logo</label>
                <div className="flex items-center gap-4">
                  {logoPreviewUrl ? (
                    <div className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white flex items-center justify-center">
                      <img
                        src={logoPreviewUrl}
                        alt="Company logo"
                        className="w-full h-full object-contain"
                      />
                      {!isViewOnly && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 text-white transition-colors duration-150 cursor-pointer"
                            title="Replace Logo"
                          >
                            <UploadCloudIcon size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setField("logo", "");
                              setLogoPreviewUrl(null);
                            }}
                            className="p-1.5 bg-red-650/80 rounded-lg hover:bg-red-750 text-white transition-colors duration-150 cursor-pointer"
                            title="Remove Logo"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    !isViewOnly ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full max-w-sm border-2 border-dashed border-slate-200 hover:border-slate-350 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
                      >
                        <span className="text-slate-400"><UploadCloudIcon size={24} /></span>
                        <span className="text-[13px] font-semibold text-slate-600">Upload corporate logo</span>
                        <span className="text-[11.5px] text-slate-400">PNG, JPG, WEBP or SVG</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)] italic">No logo uploaded</span>
                    )
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    hidden
                    onChange={handleLogoChange}
                    disabled={isUploadingLogo}
                  />
                </div>
              </div>

              <TextField
                label="Brands (comma-separated)"
                name="brands"
                value={values.brands}
                placeholder="e.g. Acme, AcmePro"
                disabled={isViewOnly}
                onChange={(e) => setField("brands", e.target.value)}
              />
            </div>

            {/* Card 2: Financials & Market */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Financials & Market</span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <TextField
                    label="Stock ticker"
                    name="stockTicker"
                    value={values.stockTicker}
                    placeholder="e.g. ACM"
                    disabled={isViewOnly}
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
                      disabled={isViewOnly}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="mb-[18px]">
                    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Region</label>
                    <CustomSelect
                      fullWidth
                      label=""
                      value={values.region}
                      onChange={(val) => setField("region", val as Region | "")}
                      options={REGION_OPTIONS}
                      disabled={isViewOnly}
                    />
                  </div>
                  <TextField
                    label="Annual spend (USD)"
                    name="annualSpend"
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.annualSpend}
                    error={errors.annualSpend}
                    disabled={isViewOnly}
                    onChange={(e) => setField("annualSpend", e.target.value)}
                  />
                </div>

                <TextField
                  label="Branches (comma-separated)"
                  name="branches"
                  value={values.branches}
                  placeholder="e.g. Singapore, London"
                  disabled={isViewOnly}
                  onChange={(e) => setField("branches", e.target.value)}
                />

                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Credit status</label>
                  <CustomSelect
                    fullWidth
                    label=""
                    value={values.credit}
                    onChange={(val) => setField("credit", val as CreditStatus | "")}
                    options={CREDIT_STATUS_OPTIONS}
                    disabled={isViewOnly}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Ownership & Territory */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Ownership & Assignment</span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="mb-[18px]">
                    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Parent company (existing)</label>
                    <CustomSelect
                      fullWidth
                      label=""
                      value={values.parentCompanyId}
                      onChange={(val) => setField("parentCompanyId", val)}
                      options={parentCompanyOptions}
                      disabled={isViewOnly}
                    />
                  </div>
                  <TextField
                    label="Or parent company name (if not listed)"
                    name="parentCompanyName"
                    value={values.parentCompanyName}
                    disabled={isViewOnly || !!values.parentCompanyId}
                    placeholder="e.g. Acme Holdings"
                    onChange={(e) => setField("parentCompanyName", e.target.value)}
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
                    disabled={isViewOnly}
                  />
                </div>

                <div className="mb-[18px]">
                  <label htmlFor="territoryNotes" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Territory notes</label>
                  <textarea
                    id="territoryNotes"
                    className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 font-[inherit] text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)] focus:outline-none"
                    rows={3}
                    value={values.territoryNotes}
                    placeholder="Any additional context about this account's territory..."
                    disabled={isViewOnly}
                    onChange={(e) => setField("territoryNotes", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Contacts ─────────────────────────────── */}
        {activeTab === "contacts" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
            {mode !== "create" && (
              <div className="mb-5">
                <p className="mb-3 text-[13.5px] font-bold text-crm-text">Existing Contacts</p>
                {isLoadingExistingContacts ? (
                  <div className="py-6 flex items-center justify-center">
                    <Spinner size={20} />
                  </div>
                ) : existingContacts.length === 0 ? (
                  <p className="deal-empty-tab">No contacts added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                    {existingContacts.map((existing) => (
                      <div key={existing.id} className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-3.5 flex items-center justify-between gap-3.5 hover:border-slate-350 transition-all duration-200">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-semibold text-[13.5px]">
                            {existing.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <span className="text-[13.5px] font-bold text-crm-text truncate">{existing.fullName}</span>
                            <span className="text-[11.5px] text-[var(--color-text-muted)] truncate">{existing.title || "No Title"}</span>
                            <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{existing.email || "—"}</span>
                          </div>
                        </div>
                        {!isViewOnly && (canUpdate || canDelete) && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canUpdate && (
                              <button
                                type="button"
                                className="p-1.5 text-slate-555 hover:text-crm-primary hover:bg-slate-100 rounded-lg transition-colors duration-150 cursor-pointer border-none bg-transparent"
                                aria-label={`Edit ${existing.fullName}`}
                                onClick={() => setEditingExistingContact(existing)}
                              >
                                <EditIcon size={14} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="p-1.5 text-slate-555 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors duration-150 cursor-pointer border-none bg-transparent"
                                aria-label={`Delete ${existing.fullName}`}
                                onClick={() => handleDeleteExistingContact(existing)}
                                disabled={deletingContactId === existing.id}
                              >
                                <TrashIcon size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isViewOnly && (
              <>
                <p className="mb-3 text-[13.5px] font-bold text-crm-text">
                  {mode === "edit" ? "Add New Contacts" : "Add Contacts"}
                </p>

                {contacts.length === 0 && (
                  <p className="deal-empty-tab bg-slate-50/30 rounded-xl border border-dashed border-slate-200 py-6 mb-4">
                    {mode === "edit" ? "No new contacts to add." : "No contacts added yet. Add one or more people at this company below."}
                  </p>
                )}

                {contacts.map((contact, index) => {
                  const isExpanded = expandedContactKeys.has(contact.key);
                  return (
                    <div key={contact.key} className="bg-slate-50/50 border border-slate-200/60 rounded-xl mb-4 overflow-hidden transition-all duration-200">
                      {/* Accordion Header */}
                      <div 
                        className="flex items-center justify-between px-4 py-3 bg-slate-100/70 border-b border-slate-200/40 cursor-pointer select-none hover:bg-slate-100 transition-colors duration-150"
                        onClick={() => toggleContactExpand(contact.key)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-semibold text-[11.5px]">
                            {index + 1}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-crm-text">
                              {contact.fullName.trim() || `New Contact #${index + 1}`}
                            </span>
                            {contact.title && (
                              <span className="text-[11px] text-[var(--color-text-muted)] leading-none mt-0.5">
                                {contact.title} {contact.roleBuying ? `• ${ROLE_BUYING_LABELS[contact.roleBuying] ?? contact.roleBuying}` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleContactExpand(contact.key)}
                            className="p-1 text-slate-500 hover:text-slate-700 rounded transition-colors duration-150 cursor-pointer border-none bg-transparent"
                          >
                            <svg 
                              className={`w-4 h-4 transform transition-transform duration-205 ${isExpanded ? "rotate-180" : ""}`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="p-1 text-slate-500 hover:text-red-650 rounded transition-colors duration-150 cursor-pointer border-none bg-transparent"
                            aria-label="Remove contact"
                            onClick={() => removeContact(contact.key)}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-slate-100">
                          <ContactFields
                            values={contact}
                            onChange={(field, value) => updateContact(contact.key, field, value as never)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                <Button type="button" variant="secondary" className="btn-add w-full justify-center border-dashed border-2 hover:bg-slate-50" onClick={addContact}>
                  <PlusIcon size={14} /> Add Contact
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Tab 4: Relationships ────────────────────────── */}
        {activeTab === "relationships" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
            {tagError && <p className="mb-2 text-[12.5px] text-[var(--color-danger)]">{tagError}</p>}
            
            <div className="bg-slate-50/30 border border-slate-200/80 rounded-xl p-6 mb-4 flex flex-col items-center justify-center">
              {isLoadingTags ? (
                <div className="h-40 flex items-center justify-center">
                  <Spinner size={20} />
                </div>
              ) : (
                <RelationshipHubDiagram
                  centerLabel={values.name}
                  spokes={tagSpokes}
                  emptyLabel={t("relationshipTags.emptyState")}
                />
              )}
            </div>

            {!isViewOnly && canCreate && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <div className="flex items-end gap-2.5">
                  <div className="flex-1">
                    <SearchSelect
                      label={t("relationshipTags.add.label")}
                      value={selectedTagTypeId}
                      onChange={setSelectedTagTypeId}
                      options={addTagOptions}
                      placeholder={t("relationshipTags.add.placeholder")}
                      searchPlaceholder={t("relationshipTags.add.searchPlaceholder")}
                      emptyLabel={t("relationshipTags.add.emptyLabel")}
                      disabled={isAddingTag}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddTag}
                    isLoading={isAddingTag}
                    disabled={!selectedTagTypeId}
                  >
                    <PlusIcon size={14} /> {t("relationshipTags.add.button")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2.5 border-t border-slate-200/60 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create company" : "Save changes"}
            </Button>
          )}
        </div>
      </form>

      {editingExistingContact && mapId && (
        <ContactFormDialog
          mode="edit"
          relationshipTypeId={relationshipTypeId}
          relationshipTypeName={relationshipTypeName}
          companyContext={{ companyMapId: mapId, contactId: editingExistingContact.id }}
          contact={editingExistingContact}
          companies={companies}
          onClose={() => setEditingExistingContact(null)}
          onSaved={() => {
            void refreshExistingContacts();
          }}
        />
      )}
    </Dialog>
  );
}