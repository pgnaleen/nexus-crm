"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, Fragment } from "react";
import {
  DealType,
  DocumentType,
  EvaluationType,
  SubmissionMode,
  type CompanyPickerResponse,
  type ContactPickerResponse,
  type DealDocumentResponse,
  type DealPartnerResponse,
  type DealResponse,
  type DealRoleAssignmentResponse,
  type DealRoleResponse,
  type DealSourceResponse,
  type DepartmentPickerResponse,
  type EmployeePickerResponse,
  type IndustryResponse,
  type RelationshipRolePickerResponse,
  type RelationshipTypeResponse,
  type UserPickerResponse,
} from "@orelia/common";
import {
  addDealPartnerCompany,
  addDealPartnerContact,
  assignDealRole,
  createDeal,
  createDealNote,
  createDealRole,
  deleteDealDocument,
  getDealTenderDetails,
  listDealDocuments,
  listDealPartners,
  listDealTeam,
  removeDealPartner,
  removeDealRoleAssignment,
  setPrimaryDealRoleAssignment,
  updateDeal,
  upsertDealTenderDetails,
  uploadDealDocument,
} from "@/lib/api/deals";
import {
  listCompaniesPicker,
  listContactsPicker,
  listDealCustomerParties,
  listDealPartnerParties,
} from "@/lib/api/pickers";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/providers/ToastProvider";
import { computeCosting, formatLkr, formatNoteTime, formatPercent, getInitials } from "@/lib/deals/deal-display";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { BuildingIcon, EditIcon, FileIcon, FunnelIcon, LegalIcon, FinanceIcon, UsersGroupIcon, TrashIcon, UploadCloudIcon, UserIcon, PlusIcon } from "@/components/ui/icons";
import { minDate, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";
import { COUNTRY_CURRENCY_MAP } from "@/lib/countries";
import { CURRENCIES } from "@/lib/currencies";
import { CompanyFormDialog } from "@/app/[tenant]/(dashboard)/relationships/[id]/_components/CompanyFormDialog";
import { ContactFormDialog } from "@/app/[tenant]/(dashboard)/relationships/[id]/_components/ContactFormDialog";

// dealType isn't shown in the form for now, but the backend contract still
// requires one on create -- default silently to the most common case until
// the field comes back.
const DEFAULT_DEAL_TYPE = DealType.NewBusiness;

const SUBMISSION_MODE_LABELS: Record<SubmissionMode, string> = {
  [SubmissionMode.Online]: "Online",
  [SubmissionMode.Physical]: "Physical",
  [SubmissionMode.Hybrid]: "Hybrid",
};
const SUBMISSION_MODE_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(SubmissionMode).map((value) => ({ value, label: SUBMISSION_MODE_LABELS[value] })),
];

const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  [EvaluationType.Technical]: "Technical",
  [EvaluationType.Financial]: "Financial",
  [EvaluationType.TechnicalAndFinancial]: "Technical & Financial",
};
const EVALUATION_TYPE_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(EvaluationType).map((value) => ({ value, label: EVALUATION_TYPE_LABELS[value] })),
];

// Shared Tailwind equivalent of the app-wide `.field-textarea` class, used
// four times in this file. Kept as a constant rather than repeating the
// string, since `.field-textarea` itself stays untouched for every other
// dialog still using it until their own restyle pass.
const TEXTAREA_CLASS =
  "w-full resize-y rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] px-3 py-2.5 font-[inherit] text-sm transition-colors duration-150 focus:outline-none focus:border-[var(--color-crm-primary)] focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)]";

interface StagedDocument {
  id: string;
  file: File;
  name: string;
  version: string;
}

// Blank Name falls back to the file's own name, blank Version falls back to
// "1.0" -- applied here, once, at upload time so every document gets a real
// stored value rather than blank/null.
function resolveDocMeta(doc: StagedDocument): { title: string; version: string } {
  return {
    title: doc.name.trim() || doc.file.name,
    version: doc.version.trim() || "1.0",
  };
}

interface CompetitorEntry {
  id: string;
  name: string;
  details: string;
}

// The dialog has no signed-in-user identity plumbed into it yet (auth state
// lives server-side only), so every note posted here is authored as
// CURRENT_USER_LABEL. That's also always true in practice, since this dialog
// only ever creates a brand-new deal -- there's no way for another user's
// note to already exist on a deal that doesn't exist yet. The edit-permission
// check below is written against that label (not hardcoded true) so the same
// code keeps working once this moves to a real multi-user comment thread on
// an existing deal.
const CURRENT_USER_LABEL = "You";

interface NoteEntry {
  id: string;
  author: string;
  createdAt: string;
  text: string;
}

interface DetailsFormState {
  name: string;
  isTender: boolean;
  sourceId: string;
  primaryContactId: string;
  // Every deal belongs to a Main Stage; currentStageId (a Sub Stage) is
  // optional -- "" means the deal sits directly in mainStageId with no
  // further breakdown, a fully supported position, not a placeholder state.
  mainStageId: string;
  currentStageId: string;
  // Deal Information tab
  dealCountry: string;
  customerPainPoint: string;
  departmentId: string;
  expectedCloseDate: string;
  // Delivery tab
  product: string;
  services: string;
  // Costing tab -- only the three raw inputs are stored (projectValue is
  // sent as the deal's estimatedValue); Total Cost, Profit, Markup, and
  // Margin are all derived from these at render time (see computeCosting
  // below), never stored directly, so they can never drift out of sync with
  // the numbers that produced them.
  currency: string;
  projectValue: string;
  internalCosts: string;
  externalCosts: string;
  // Team tab -- the mandatory primary Sales Person only. Every other role
  // (Pre-Sales, PMO, custom) and additional Sales Person teammates are
  // staged separately (see roleAssignmentValues) since they're not part of
  // CreateDealRequest itself.
  salesPersonUserId: string;
  // Tender tab -- only shown/sent when isTender is checked, saved to its own
  // deal_tender_details row via a separate upsert call, not part of the
  // deal's own PATCH/POST body.
  tenderReference: string;
  issuingBody: string;
  bidBondRequired: boolean;
  bidBondAmount: string;
  emdAmount: string;
  submissionMode: SubmissionMode | "";
  evaluationType: EvaluationType | "";
}

type PartyKind = "company" | "contact";

interface OtherParty {
  kind: PartyKind;
  id: string;
}

function partyValue(party: OtherParty | null): string {
  return party ? `${party.kind}:${party.id}` : "";
}

function parsePartyValue(value: string): OtherParty | null {
  const [kind, id] = value.split(":");
  if (kind !== "company" && kind !== "contact") return null;
  if (!id) return null;
  return { kind, id };
}

type TabId = "dealInfo" | "tender" | "delivery" | "costing" | "documents" | "notes" | "competition" | "team";

// Nested "create a new company/person" flow, reusing the exact same dialogs
// the Relationships section uses -- a new party still has to be tagged with
// a Relationship Type there, so we ask for that first.
type AddPartyState =
  | { step: "type" }
  | { step: "kind"; relationshipTypeId: string; relationshipTypeName: string }
  | { step: "company"; relationshipTypeId: string; relationshipTypeName: string }
  | { step: "contact"; relationshipTypeId: string; relationshipTypeName: string }
  | null;

function ChooseRelationshipTypeDialog({
  title,
  relationshipTypes,
  onClose,
  onSelect,
}: {
  title: string;
  relationshipTypes: RelationshipTypeResponse[];
  onClose: () => void;
  onSelect: (relationshipType: RelationshipTypeResponse) => void;
}) {
  return (
    <Dialog open title={title} onClose={onClose} maxWidth="420px">
      <p className="mb-4 text-[var(--color-text-muted)]">Which relationship type does this belong to?</p>
      {relationshipTypes.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-danger)]">No relationship types configured yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {relationshipTypes.map((rt) => (
            <button
              key={rt.id}
              type="button"
              className="flex cursor-pointer justify-center rounded-lg border-0 bg-[var(--color-crm-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-crm-primary-hover)]"
              onClick={() => onSelect(rt)}
            >
              {rt.name}
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

interface AddDealDialogProps {
  mode?: "create" | "edit";
  // Required when mode === "edit" -- the deal being edited, used to prefill
  // every field. AddDealDialog always receives the full object from the
  // caller's own already-fetched deal list/detail rather than fetching it
  // itself.
  deal?: DealResponse;
  dealSources: DealSourceResponse[];
  // Every Main Stage in the tenant, for the Stage field -- always required,
  // regardless of which board this dialog was opened from.
  mainStages: { id: string; name: string }[];
  // Every Sub Stage in the tenant, tagged with its owning Main Stage --
  // filtered down to the chosen Main Stage's own Sub Stages for the second,
  // optional picker underneath. A Main Stage with none simply shows no
  // second picker at all -- that's a fully supported position, not an error.
  subStages: { id: string; name: string; mainStageId: string }[];
  // Pre-selects the Main Stage field when opened from that stage's own page
  // -- still changeable, just a default, same treatment as
  // defaultDealSourceId below.
  defaultMainStageId?: string;
  companies: CompanyPickerResponse[];
  employees: EmployeePickerResponse[];
  contacts: ContactPickerResponse[];
  departments: DepartmentPickerResponse[];
  relationshipTypes: RelationshipTypeResponse[];
  industries: IndustryResponse[];
  // Deal Team tab -- deal_roles for the tenant (Sales Person/Pre-Sales/PMO
  // plus any custom role) and every active user for the assignment pickers.
  // Keyed on User, not Employee -- see DealRoleAssignment's own comment.
  dealRoles: DealRoleResponse[];
  users: UserPickerResponse[];
  // Companies/contacts tagged under the tenant's flagged Customer/Partner
  // relationship type -- what actually populates the Customer/Partners
  // pickers below, distinct from the unfiltered `companies`/`contacts` above
  // (which are still needed for companyNameById/primaryContactOptions/etc).
  customerParties: RelationshipRolePickerResponse;
  partnerParties: RelationshipRolePickerResponse;
  defaultDealSourceId?: string;
  onClose: () => void;
  onCreated?: (deal: DealResponse) => void;
  onUpdated?: (deal: DealResponse) => void;
}

export function AddDealDialog({
  mode = "create",
  deal,
  dealSources,
  mainStages,
  subStages,
  defaultMainStageId,
  companies: initialCompanies,
  employees,
  contacts: initialContacts,
  departments,
  relationshipTypes,
  industries,
  dealRoles: initialDealRoles,
  users,
  customerParties: initialCustomerParties,
  partnerParties: initialPartnerParties,
  defaultDealSourceId,
  onClose,
  onCreated,
  onUpdated,
}: AddDealDialogProps) {
  const isEdit = mode === "edit";
  const [activeTab, setActiveTab] = useState<TabId>("dealInfo");
  const [companies, setCompanies] = useState(initialCompanies);
  const [contacts, setContacts] = useState(initialContacts);
  const [customerParties, setCustomerParties] = useState(initialCustomerParties);
  const [partnerParties, setPartnerParties] = useState(initialPartnerParties);
  const [dealRoles, setDealRoles] = useState(initialDealRoles);
  const [values, setValues] = useState<DetailsFormState>(() => ({
    name: deal?.name ?? "",
    isTender: deal?.isTender ?? false,
    sourceId:
      deal?.sourceId ?? (dealSources.some((s) => s.id === defaultDealSourceId) ? (defaultDealSourceId ?? "") : ""),
    primaryContactId: deal?.primaryContactId ?? "",
    mainStageId: deal?.mainStageId ?? defaultMainStageId ?? mainStages[0]?.id ?? "",
    // "" means no Sub Stage -- the deal sits directly in the Main Stage
    // above. Deliberately not defaulted to that Main Stage's first Sub
    // Stage: the client's stated requirement is that a deal can move
    // through Main Stages with no Sub Stage involved at all.
    currentStageId: deal?.currentStageId ?? "",
    dealCountry: deal?.dealCountry ?? "",
    customerPainPoint: deal?.customerPainPoint ?? "",
    departmentId: deal?.departmentId ?? "",
    expectedCloseDate: deal?.expectedCloseDate ?? "",
    product: deal?.product ?? "",
    services: deal?.services ?? "",
    currency: deal?.currency ?? "USD",
    projectValue: deal?.estimatedValue != null ? Number(deal.estimatedValue).toLocaleString("en-US") : "",
    internalCosts: deal?.internalCosts != null ? Number(deal.internalCosts).toLocaleString("en-US") : "",
    externalCosts: deal?.externalCosts != null ? Number(deal.externalCosts).toLocaleString("en-US") : "",
    salesPersonUserId: deal?.primarySalesPersonUserId ?? "",
    // Tender fields aren't on DealResponse -- fetched separately below and
    // merged in once loaded (edit mode only, when the deal is a tender).
    tenderReference: "",
    issuingBody: "",
    bidBondRequired: false,
    bidBondAmount: "",
    emdAmount: "",
    submissionMode: "",
    evaluationType: "",
  }));
  const [otherParty, setOtherParty] = useState<OtherParty | null>(() => {
    if (!deal) return null;
    if (deal.companyId) return { kind: "company", id: deal.companyId };
    if (deal.contactId) return { kind: "contact", id: deal.contactId };
    return null;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsFormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(
    () => deal?.competitors?.map((c) => ({ id: crypto.randomUUID(), name: c.name, details: c.details })) ?? [],
  );
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteDraft, setEditNoteDraft] = useState("");
  const [partnerValues, setPartnerValues] = useState<string[]>([]);
  // Create mode only -- staged per-role selections (roleId -> userIds),
  // applied after the deal is created (mirrors partnerValues). Never
  // includes the primary Sales Person slot, which is values.salesPersonUserId.
  const [roleAssignmentValues, setRoleAssignmentValues] = useState<Record<string, string[]>>({});
  const [newRoleName, setNewRoleName] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [addPartyState, setAddPartyState] = useState<AddPartyState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  // Chat-style auto-scroll: jump to the newest draft note whenever one is
  // added or removed.
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ block: "end" });
  }, [notes]);

  // Edit mode only -- the deal already exists, so Documents/Partners are
  // fetched for real (not staged locally like create mode) and every
  // add/remove applies immediately via its own endpoint.
  const [existingDocuments, setExistingDocuments] = useState<DealDocumentResponse[]>([]);
  const [existingPartners, setExistingPartners] = useState<DealPartnerResponse[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<DealRoleAssignmentResponse[]>([]);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  useEffect(() => {
    if (!isEdit || !deal) return;
    let cancelled = false;
    Promise.all([listDealDocuments(deal.id), listDealPartners(deal.id), listDealTeam(deal.id)])
      .then(([docsRes, partnersRes, teamRes]) => {
        if (cancelled) return;
        setExistingDocuments(docsRes);
        setExistingPartners(partnersRes);
        setExistingAssignments(teamRes);
      })
      .catch(() => {
        // Non-fatal -- the tabs just show empty until the dialog is reopened.
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, deal]);

  // Edit mode only, and only when the deal is already a tender -- tender
  // fields live in their own table, not on DealResponse, so they're fetched
  // separately and merged into `values` once loaded.
  useEffect(() => {
    if (!isEdit || !deal || !deal.isTender) return;
    let cancelled = false;
    getDealTenderDetails(deal.id)
      .then((row) => {
        if (cancelled || !row) return;
        setValues((current) => ({
          ...current,
          tenderReference: row.tenderReference,
          issuingBody: row.issuingBody,
          bidBondRequired: row.bidBondRequired,
          bidBondAmount: row.bidBondAmount != null ? Number(row.bidBondAmount).toLocaleString("en-US") : "",
          emdAmount: row.emdAmount != null ? Number(row.emdAmount).toLocaleString("en-US") : "",
          submissionMode: row.submissionMode ?? "",
          evaluationType: row.evaluationType ?? "",
        }));
      })
      .catch(() => {
        // Non-fatal -- the Tender tab just starts blank if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, deal]);

  // Unchecking "This is a Tender deal" drops the Tender tab from tabDefs --
  // if it was the active tab, fall back to Deal Information rather than
  // leaving the dialog stuck on a tab with no button left to reach it.
  useEffect(() => {
    if (!values.isTender && activeTab === "tender") {
      setActiveTab("dealInfo");
    }
  }, [values.isTender, activeTab]);

  function setField<K extends keyof DetailsFormState>(field: K, value: DetailsFormState[K]) {
    let finalValue = value;
    if (
      typeof value === "string" &&
      ["bidBondAmount", "emdAmount", "projectValue", "internalCosts", "externalCosts"].includes(field)
    ) {
      const clean = value.replace(/[^\d.]/g, "");
      if (clean === "") {
        finalValue = "" as DetailsFormState[K];
      } else {
        const [integer, decimal] = clean.split(".");
        const formattedInteger = integer ? Number(integer).toLocaleString("en-US") : "";
        finalValue = (decimal !== undefined ? `${formattedInteger}.${decimal}` : formattedInteger) as DetailsFormState[K];
      }
    }
    setValues((current) => ({ ...current, [field]: finalValue }));
  }

  function handleOtherPartyChange(value: string) {
    const party = parsePartyValue(value);
    setOtherParty(party);
    // A person picked directly *is* the primary contact; a company needs one
    // of its contacts picked separately (or none, for now).
    setField("primaryContactId", "");
  }

  // The customer: a company (companyId) or a bare contact with no company of
  // its own (contactId) -- never both, matching the single "Other Party"
  // selection. Shared by create and edit -- both send whichever one is set.
  function deriveCustomerFields(party: OtherParty | null): { companyId?: string; contactId?: string } {
    if (party?.kind === "company") return { companyId: party.id };
    if (party?.kind === "contact") return { contactId: party.id };
    return {};
  }

  async function refreshPickers() {
    try {
      const [freshCompanies, freshContacts, freshCustomerParties, freshPartnerParties] = await Promise.all([
        listCompaniesPicker(),
        listContactsPicker(),
        listDealCustomerParties(),
        listDealPartnerParties(),
      ]);
      setCompanies(freshCompanies);
      setContacts(freshContacts);
      setCustomerParties(freshCustomerParties);
      setPartnerParties(freshPartnerParties);
    } catch {
      // Non-fatal -- the newly created party just won't show up until the
      // next natural refresh (e.g. reopening the dialog).
    }
  }

  // "YYYY-MM-DD" in the user's local timezone, matching the format
  // <input type="date"> reads/writes -- used both as the native min= floor
  // and in the past-date validation below.
  const todayISO = new Date().toLocaleDateString("en-CA");

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof DetailsFormState, string>> = {};

    const nameError = validate(values.name, [required("Deal name is required")]);
    if (nameError) nextErrors.name = nameError;
    // Customer is optional -- a deal can be created with no company/contact
    // set and have one added later once it's known.
    if (!values.salesPersonUserId) nextErrors.salesPersonUserId = "Sales Person is required";
    if (!isEdit && !values.mainStageId) {
      nextErrors.mainStageId = "Select a stage to create this deal in — add a Main Stage first";
    }
    // Skip the past-date check when editing a deal whose deadline was
    // already in the past before this session -- otherwise saving an
    // unrelated field on an old, already-overdue deal would be blocked.
    const deadlineUnchanged = isEdit && values.expectedCloseDate === (deal?.expectedCloseDate ?? "");
    if (!deadlineUnchanged) {
      const dateError = validate(values.expectedCloseDate, [
        minDate(todayISO, "Expected deadline can't be in the past"),
      ]);
      if (dateError) nextErrors.expectedCloseDate = dateError;
    }
    if (values.isTender) {
      const tenderReferenceError = validate(values.tenderReference, [required("Tender reference is required")]);
      if (tenderReferenceError) nextErrors.tenderReference = tenderReferenceError;
      const issuingBodyError = validate(values.issuingBody, [required("Issuing body is required")]);
      if (issuingBodyError) nextErrors.issuingBody = issuingBodyError;
    }

    setErrors(nextErrors);

    // Jump to whichever tab actually holds the first invalid field.
    if (nextErrors.name || nextErrors.mainStageId || nextErrors.expectedCloseDate) {
      setActiveTab("dealInfo");
    } else if (nextErrors.tenderReference || nextErrors.issuingBody) {
      setActiveTab("tender");
    } else if (nextErrors.salesPersonUserId) {
      setActiveTab("team");
    }

    return Object.keys(nextErrors).length === 0;
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    // Both modes stage first now -- the user gets a moment to edit Name/
    // Version before anything is actually uploaded. Edit mode's previous
    // instant-upload-on-select is gone; it now needs an explicit Upload
    // click (uploadStagedDocument below) once those fields are filled in.
    const next = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      version: "",
    }));
    setDocuments((prev) => [...prev, ...next]);
  }

  function updateStagedDocument(id: string, field: "name" | "version", value: string) {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc)));
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }

  // Edit mode only -- uploads one staged document for real and moves it
  // into existingDocuments on success (create mode uploads everything
  // staged at deal-creation submit time instead, see handleSubmit).
  async function uploadStagedDocument(id: string) {
    if (!deal) return;
    const staged = documents.find((doc) => doc.id === id);
    if (!staged) return;
    setIsUploadingDocs(true);
    try {
      const doc = await uploadDealDocument(deal.id, staged.file, { docType: DocumentType.Other, ...resolveDocMeta(staged) });
      setExistingDocuments((prev) => [...prev, doc]);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to upload document");
    } finally {
      setIsUploadingDocs(false);
    }
  }

  async function removeExistingDocument(documentId: string) {
    if (!deal) return;
    try {
      await deleteDealDocument(deal.id, documentId);
      setExistingDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to remove document");
    }
  }

  async function handleAddExistingPartner(value: string) {
    if (!deal) return;
    const partner = parsePartyValue(value);
    if (!partner) return;
    try {
      const added =
        partner.kind === "company"
          ? await addDealPartnerCompany(deal.id, partner.id)
          : await addDealPartnerContact(deal.id, partner.id);
      setExistingPartners((prev) => [...prev, added]);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add partner");
    }
  }

  async function removeExistingPartner(partnerId: string) {
    if (!deal) return;
    try {
      await removeDealPartner(deal.id, partnerId);
      setExistingPartners((prev) => prev.filter((p) => p.id !== partnerId));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to remove partner");
    }
  }

  function addCompetitor() {
    setCompetitors((prev) => [...prev, { id: crypto.randomUUID(), name: "", details: "" }]);
  }

  function removeCompetitor(id: string) {
    setCompetitors((prev) => prev.filter((competitor) => competitor.id !== id));
  }

  function updateCompetitor(id: string, field: "name" | "details", value: string) {
    setCompetitors((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function postNote() {
    const text = draftNote.trim();
    if (!text) return;
    setNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: CURRENT_USER_LABEL, createdAt: new Date().toISOString(), text },
    ]);
    setDraftNote("");
  }

  function startEditNote(note: NoteEntry) {
    if (note.author !== CURRENT_USER_LABEL) return;
    setEditingNoteId(note.id);
    setEditNoteDraft(note.text);
  }

  function saveEditNote(id: string) {
    const text = editNoteDraft.trim();
    if (!text) return;
    setNotes((prev) => prev.map((n) => (n.id === id && n.author === CURRENT_USER_LABEL ? { ...n, text } : n)));
    setEditingNoteId(null);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropActive(false);
    addFiles(event.dataTransfer.files);
  }

  function buildTenderDetailsPayload() {
    return {
      tenderReference: values.tenderReference.trim(),
      issuingBody: values.issuingBody.trim(),
      bidBondRequired: values.bidBondRequired,
      bidBondAmount: values.bidBondAmount.trim() ? Number(values.bidBondAmount.replace(/,/g, "")) : undefined,
      emdAmount: values.emdAmount.trim() ? Number(values.emdAmount.replace(/,/g, "")) : undefined,
      submissionMode: values.submissionMode || undefined,
      evaluationType: values.evaluationType || undefined,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) {
      return;
    }

    if (isEdit) {
      if (!deal) return;
      setIsSaving(true);
      try {
        const updated = await updateDeal(deal.id, {
          name: values.name.trim(),
          isTender: values.isTender,
          currency: values.currency,
          ...deriveCustomerFields(otherParty),
          primaryContactId: otherParty?.kind === "company" ? values.primaryContactId || undefined : undefined,
          sourceId: values.sourceId || undefined,
          departmentId: values.departmentId || undefined,
          dealCountry: values.dealCountry || undefined,
          customerPainPoint: values.customerPainPoint || undefined,
          expectedCloseDate: values.expectedCloseDate || undefined,
          product: values.product || undefined,
          services: values.services || undefined,
          estimatedValue: values.projectValue ? Number(values.projectValue.replace(/,/g, "")) : undefined,
          internalCosts: values.internalCosts ? Number(values.internalCosts.replace(/,/g, "")) : undefined,
          externalCosts: values.externalCosts ? Number(values.externalCosts.replace(/,/g, "")) : undefined,
          competitors:
            competitors.length > 0 ? competitors.map((c) => ({ name: c.name, details: c.details })) : undefined,
        });
        onUpdated?.(updated);

        // Separate call, separate failure mode -- the deal itself already
        // saved successfully by this point, so a tender-details failure must
        // never be reported as "failed to save deal" (same reasoning as the
        // create-mode attachments below).
        if (values.isTender) {
          try {
            await upsertDealTenderDetails(deal.id, buildTenderDetailsPayload());
          } catch (err) {
            showToast({
              message: `Deal saved, but tender details failed to save (${
                err instanceof ApiError ? err.message : "unknown error"
              }).`,
              durationMs: 8000,
            });
          }
        }

        onClose();
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : "Failed to save deal");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // The customer: a company (companyId) or a bare contact with no company
    // of its own (contactId) -- never both, matching the single "Other
    // Party" selection.
    let companyId: string | undefined;
    let contactId: string | undefined;
    let primaryContactId: string | undefined;
    if (otherParty?.kind === "company") {
      companyId = otherParty.id;
      primaryContactId = values.primaryContactId || undefined;
    } else if (otherParty?.kind === "contact") {
      contactId = otherParty.id;
      primaryContactId = otherParty.id;
    }

    setIsSaving(true);

    // Split deliberately: creating the deal and attaching its
    // documents/partners/notes are two separate network steps, not one
    // atomic operation. If the deal itself fails, nothing was created and
    // the form should stay exactly as it is. But once the deal exists, a
    // failed attachment afterward must never be reported as "failed to
    // create deal" -- that misleads the user into resubmitting, which
    // creates a real duplicate deal (the original bug here).
    let createdDeal: DealResponse;
    try {
      createdDeal = await createDeal({
        name: values.name.trim(),
        isTender: values.isTender,
        dealType: DEFAULT_DEAL_TYPE,
        currency: values.currency,
        companyId,
        contactId,
        primaryContactId,
        sourceId: values.sourceId || undefined,
        // The mandatory primary Sales Person -- inserted atomically with the
        // deal itself by the backend (see DealsService.create()). Every
        // other role/teammate is attached afterward, below, once the deal
        // has an id.
        salesPersonUserId: values.salesPersonUserId,
        mainStageId: values.mainStageId,
        currentStageId: values.currentStageId || undefined,
        departmentId: values.departmentId || undefined,
        dealCountry: values.dealCountry || undefined,
        customerPainPoint: values.customerPainPoint || undefined,
        expectedCloseDate: values.expectedCloseDate || undefined,
        product: values.product || undefined,
        services: values.services || undefined,
        estimatedValue: values.projectValue ? Number(values.projectValue.replace(/,/g, "")) : undefined,
        internalCosts: values.internalCosts ? Number(values.internalCosts.replace(/,/g, "")) : undefined,
        externalCosts: values.externalCosts ? Number(values.externalCosts.replace(/,/g, "")) : undefined,
        competitors: competitors.length > 0
          ? competitors.map((c) => ({ name: c.name, details: c.details }))
          : undefined,
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create deal");
      setIsSaving(false);
      return;
    }

    try {
      await Promise.all([
        ...documents.map((doc) =>
          uploadDealDocument(createdDeal.id, doc.file, { docType: DocumentType.Other, ...resolveDocMeta(doc) }),
        ),
        ...partnerValues.map((value) => {
          const partner = parsePartyValue(value);
          if (!partner) return Promise.resolve();
          return partner.kind === "company"
            ? addDealPartnerCompany(createdDeal.id, partner.id)
            : addDealPartnerContact(createdDeal.id, partner.id);
        }),
        ...notes.map((note) => createDealNote(createdDeal.id, { text: note.text })),
        ...(values.isTender ? [upsertDealTenderDetails(createdDeal.id, buildTenderDetailsPayload())] : []),
        ...Object.entries(roleAssignmentValues).flatMap(([roleId, userIds]) =>
          userIds.map((userId) => assignDealRole(createdDeal.id, { roleId, userId })),
        ),
      ]);
    } catch (err) {
      showToast({
        message: `Deal ${createdDeal.dealCode} was created, but one or more attachments failed to save (${
          err instanceof ApiError ? err.message : "unknown error"
        }). You can add them again from View Deal.`,
        durationMs: 8000,
      });
    }

    setIsSaving(false);
    onCreated?.(createdDeal);
    onClose();
  }

  // companyNameById stays sourced from the unfiltered `companies` prop --
  // needed for primaryContactOptions below even for companies outside the
  // Customer-tagged set (e.g. viewing an existing deal's already-picked
  // customer, or looking up a partner's contacts).
  const companyNameById = new Map(companies.map((c) => [c.id, c.name]));
  const subStagesForMainStage = subStages.filter((s) => s.mainStageId === values.mainStageId);

  function toPartyOptions(parties: RelationshipRolePickerResponse): SearchSelectOption[] {
    return [
      ...parties.companies.map((c) => ({
        value: `company:${c.id}`,
        label: c.name,
        sublabel: "Company",
        icon: <BuildingIcon size={14} />,
      })),
      ...parties.contacts.map((c) => ({
        value: `contact:${c.id}`,
        label: c.fullName,
        sublabel: c.companyId ? companyNameById.get(c.companyId) ?? "Person" : "Person (no company)",
        icon: <UserIcon size={14} />,
      })),
    ];
  }

  // The picker only lists currently-active Customer-tagged parties. When
  // editing a deal whose customer has since been deactivated/untagged,
  // append it so the field keeps showing its current value instead of going
  // blank -- same fallback pattern as salesPersonOptions/activeDealSources
  // below (can't be re-selected once changed, which is intended).
  const otherPartyOptions: SearchSelectOption[] = (() => {
    const base = toPartyOptions(customerParties);
    if (!isEdit || !deal || !otherParty) return base;
    if (base.some((o) => o.value === partyValue(otherParty))) return base;
    const label = otherParty.kind === "company" ? deal.companyName : deal.contactName;
    return [
      ...base,
      {
        value: partyValue(otherParty),
        label: label ?? "Unknown",
        sublabel: otherParty.kind === "company" ? "Company" : "Person",
        icon: otherParty.kind === "company" ? <BuildingIcon size={14} /> : <UserIcon size={14} />,
      },
    ];
  })();

  // Excludes whichever party is already the deal's customer, and (in edit
  // mode) whichever parties are already linked as partners -- a company or
  // contact shouldn't be offered twice.
  const existingPartnerValues = new Set(
    existingPartners.map((p) => (p.kind === "company" ? `company:${p.companyId}` : `contact:${p.contactId}`)),
  );
  const partnerOptions: SearchSelectOption[] = toPartyOptions(partnerParties).filter(
    (opt) => opt.value !== partyValue(otherParty) && !existingPartnerValues.has(opt.value),
  );

  const companyContacts = otherParty?.kind === "company" ? contacts.filter((c) => c.companyId === otherParty.id) : [];
  const primaryContactOptions: SearchSelectOption[] = companyContacts.map((c) => ({
    value: c.id,
    label: c.fullName,
    icon: <UserIcon size={14} />,
  }));

  // Team tab -- keyed on User, not Employee (see DealRoleAssignment's own
  // comment). The picker only lists active users (see UsersService.findPicker).
  // When editing a deal whose primary Sales Person has since been deactivated,
  // append them so the field keeps showing its current value instead of going
  // blank -- same fallback pattern as activeDealSources below (can't be
  // re-selected once changed, which is intended).
  const baseUserOptions: SearchSelectOption[] = users.map((u) => ({ value: u.id, label: u.displayName }));
  const salesPersonPrimaryOptions: SearchSelectOption[] = (() => {
    if (!deal || baseUserOptions.some((o) => o.value === deal.primarySalesPersonUserId)) return baseUserOptions;
    if (!deal.primarySalesPersonUserId) return baseUserOptions;
    return [...baseUserOptions, { value: deal.primarySalesPersonUserId, label: deal.primarySalesPersonName ?? "Unknown" }];
  })();
  const salesPersonRoleId = dealRoles.find((r) => r.requiresPrimaryOnCreate)?.id;

  // Every userId already holding *any* assignment (including the primary)
  // for a given role -- excluded from that role's "add" options so the same
  // person can't be picked twice for one role.
  function assignedUserIdsForRole(roleId: string): Set<string> {
    const ids = existingAssignments.filter((a) => a.roleId === roleId).map((a) => a.userId);
    if (roleId === salesPersonRoleId && values.salesPersonUserId) ids.push(values.salesPersonUserId);
    return new Set(ids);
  }

  async function handleAssignRole(roleId: string, userId: string) {
    if (!deal) return;
    try {
      const assignment = await assignDealRole(deal.id, { roleId, userId });
      setExistingAssignments((prev) => [...prev, assignment]);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to assign team member");
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!deal) return;
    try {
      await removeDealRoleAssignment(deal.id, assignmentId);
      setExistingAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to remove team member");
    }
  }

  // Edit mode only -- changing the primary Sales Person. If the newly chosen
  // person isn't already on the deal's team for this role, assign them
  // first, then promote that assignment to primary (two calls, same
  // sequential-network-step precedent as the create-flow's own attachments).
  async function handleChangePrimarySalesPerson(userId: string) {
    if (!deal || !salesPersonRoleId || userId === values.salesPersonUserId) return;
    try {
      let assignment = existingAssignments.find((a) => a.roleId === salesPersonRoleId && a.userId === userId);
      if (!assignment) {
        assignment = await assignDealRole(deal.id, { roleId: salesPersonRoleId, userId });
        setExistingAssignments((prev) => [...prev, assignment!]);
      }
      const promoted = await setPrimaryDealRoleAssignment(deal.id, assignment.id);
      setExistingAssignments((prev) =>
        prev.map((a) => (a.roleId === salesPersonRoleId ? { ...a, isPrimary: a.id === promoted.id } : a)),
      );
      setField("salesPersonUserId", userId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to change Sales Person");
    }
  }

  async function handleAddRole() {
    const name = newRoleName.trim();
    if (!name) return;
    setIsAddingRole(true);
    try {
      const role = await createDealRole({ name });
      setDealRoles((prev) => [...prev, role]);
      setNewRoleName("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add role");
    } finally {
      setIsAddingRole(false);
    }
  }

  const departmentOptions: SearchSelectOption[] = departments.map((d) => ({ value: d.id, label: d.name }));
  const costing = computeCosting(values.projectValue, values.internalCosts, values.externalCosts);
  // Only active deal sources are selectable. When editing a deal whose source
  // has since been deactivated, re-append it so the field keeps its current
  // value (but it can't be re-picked once changed) -- same fallback pattern as
  // the exited-employee handling above.
  const activeDealSources = dealSources.filter((ds) => ds.isActive);
  if (deal?.sourceId && !activeDealSources.some((ds) => ds.id === deal.sourceId)) {
    const current = dealSources.find((ds) => ds.id === deal.sourceId);
    if (current) activeDealSources.push(current);
  }
  const dealSourceOptions = [
    { value: "", label: "Not set" },
    ...activeDealSources.map((ds) => ({ value: ds.id, label: ds.name })),
  ];
  function openAddParty() {
    if (relationshipTypes && relationshipTypes.length === 1 && relationshipTypes[0]) {
      setAddPartyState({
        step: "kind",
        relationshipTypeId: relationshipTypes[0].id,
        relationshipTypeName: relationshipTypes[0].name,
      });
    } else {
      setAddPartyState({ step: "type" });
    }
  }

  function handlePartySaved() {
    void refreshPickers();
    setAddPartyState(null);
  }

  const documentCount = isEdit ? existingDocuments.length : documents.length;

  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const [scrollProgress, setScrollProgress] = useState({ left: 0, width: 40, show: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 5);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);

    const hasScroll = el.scrollWidth > el.clientWidth;
    if (hasScroll) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const width = Math.max(12, (el.clientWidth / el.scrollWidth) * 40);
      const maxLeft = 40 - width;
      const left = maxScroll > 0 ? (el.scrollLeft / maxScroll) * maxLeft : 0;
      setScrollProgress({ left, width, show: true });
    } else {
      setScrollProgress({ left: 0, width: 40, show: false });
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, [activeTab]);
  const tabDefs: [TabId, string][] = [
    ["dealInfo", "Deal Information"],
    // Only shown once "This is a Tender deal" is checked on the Deal
    // Information tab.
    ...(values.isTender ? ([["tender", "Tender"]] as [TabId, string][]) : []),
    ["delivery", "Delivery"],
    ["costing", "Costing"],
    ["documents", `Documents${documentCount > 0 ? ` (${documentCount})` : ""}`],
    // Notes is omitted in edit mode -- ViewDealDialog already fully owns
    // notes (view/post/edit-your-own) for an existing deal; duplicating that
    // here too would just be the same feature built twice.
    ...(isEdit ? [] : ([["notes", "Notes"]] as [TabId, string][])),
    ["competition", "Competition"],
    ["team", "Team"],
  ];

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <FunnelIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">
          {isEdit ? "Edit Deal" : "Add New Deal"}
        </span>
        {isEdit && deal && (
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
            {deal.name}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open title={dialogTitle} onClose={onClose} maxWidth="960px">
      <form onSubmit={handleSubmit}>        <div className="relative mb-6">
          {showLeftFade && (
            <div className="absolute left-1 top-1 bottom-1 w-10 bg-gradient-to-r from-slate-100/90 to-transparent pointer-events-none z-10 rounded-l-lg" />
          )}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex flex-nowrap items-center bg-slate-100/90 p-1 rounded-xl select-none border border-slate-200/40 shadow-sm w-full overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none] gap-1"
          >
            {tabDefs.map(([id, label], idx) => {
              const isActive = activeTab === id;
              
              let cleanLabel = label;
              if (id === "documents") cleanLabel = "Documents";
              if (id === "notes") cleanLabel = "Notes";
              
              let icon = null;
              if (id === "dealInfo") {
                icon = <FunnelIcon size={14} />;
              } else if (id === "tender") {
                icon = <LegalIcon size={14} />;
              } else if (id === "delivery") {
                icon = (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                );
              } else if (id === "costing") {
                icon = <FinanceIcon size={14} />;
              } else if (id === "documents") {
                icon = <FileIcon size={14} />;
              } else if (id === "notes") {
                icon = (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                );
              } else if (id === "competition") {
                icon = (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                );
              } else if (id === "team") {
                icon = <UsersGroupIcon size={14} />;
              }

              let clipPath = "";
              if (isActive) {
                const isFirst = idx === 0;
                const isLast = idx === tabDefs.length - 1;
                if (isFirst) {
                  clipPath = "polygon(0 0, 100% 0, 88% 100%, 0 100%)";
                } else if (isLast) {
                  clipPath = "polygon(12% 0, 100% 0, 100% 100%, 0 100%)";
                } else {
                  clipPath = "polygon(12% 0, 100% 0, 88% 100%, 0 100%)";
                }
              }

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative flex items-center justify-center gap-1.5 py-1.5 px-3.5 sm:px-4 font-bold transition-all duration-150 border-none outline-none focus:outline-none cursor-pointer shrink-0 rounded-lg ${
                    isActive
                      ? "text-white select-none"
                      : "text-slate-550 hover:bg-slate-200/50 hover:text-slate-800"
                  }`}
                >
                  {isActive && (
                    <div 
                      className={`absolute inset-0 bg-crm-primary shadow-sm ${
                        idx === 0 ? "rounded-l-lg" : idx === tabDefs.length - 1 ? "rounded-r-lg" : ""
                      }`}
                      style={{ clipPath }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 text-[12.5px] sm:text-[13px] whitespace-nowrap">
                    {icon}
                    {cleanLabel}
                  </span>
                </button>
              );
            })}
          </div>
          {showRightFade && (
            <div className="absolute right-1 top-1 bottom-1 w-10 bg-gradient-to-l from-slate-100/90 to-transparent pointer-events-none z-10 rounded-r-lg" />
          )}
        </div>

        {scrollProgress.show && (
          <div className="flex justify-center mb-5 -mt-3.5">
            <div className="w-10 h-[3px] bg-slate-200/60 rounded-full relative overflow-hidden">
              <div 
                className="h-full bg-slate-400 rounded-full absolute transition-all duration-75"
                style={{
                  left: `${scrollProgress.left}px`,
                  width: `${scrollProgress.width}px`
                }}
              />
            </div>
          </div>
        )}

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        {/* ── Deal Information ──────────────────────────── */}
        {activeTab === "dealInfo" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
            {/* Card 1: Deal Basics */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-500"><FunnelIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Deal Basics</span>
              </div>
              <div className="space-y-1">
                <TextField
                  label="Deal Name *"
                  name="name"
                  value={values.name}
                  error={errors.name}
                  placeholder="e.g. TechNova Inc. — Platform Rollout"
                  onChange={(e) => setField("name", e.target.value)}
                />

                <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
                  <input
                    type="checkbox"
                    checked={values.isTender}
                    onChange={(e) => setField("isTender", e.target.checked)}
                  />
                  <span className="font-semibold">This is a Tender deal</span>
                </label>

                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Stage {!isEdit && "*"}
                  </label>
                  {isEdit ? (
                    <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[13.5px] text-[var(--color-text-muted)]">
                      {deal?.mainStageName ?? "—"}
                      {deal?.currentStageName ? ` › ${deal.currentStageName}` : ""}
                    </div>
                  ) : (
                    <CustomSelect
                      fullWidth
                      label=""
                      value={values.mainStageId}
                      onChange={(val) => {
                        setField("mainStageId", val);
                        setField("currentStageId", "");
                      }}
                      options={mainStages.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  )}
                  {errors.mainStageId && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{errors.mainStageId}</p>
                  )}
                </div>

                {!isEdit && subStagesForMainStage.length > 0 && (
                  <div className="mb-[18px]">
                    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                      Sub Stage
                    </label>
                    <CustomSelect
                      fullWidth
                      label=""
                      value={values.currentStageId}
                      onChange={(val) => setField("currentStageId", val)}
                      options={[
                        { value: "", label: "No sub stage yet" },
                        ...subStagesForMainStage.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                    />
                  </div>
                )}

                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Deal Source
                  </label>
                  <CustomSelect
                    fullWidth
                    label=""
                    value={values.sourceId}
                    onChange={(val) => setField("sourceId", val)}
                    options={dealSourceOptions}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Customer & Assignment */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-550"><UserIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Customer & Assignment</span>
              </div>
              <div className="space-y-1">
                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Customer (Company or Contact)
                  </label>
                  {!customerParties.configured ? (
                    <p className="text-[12.5px] text-[var(--color-danger)]">{t("addDealDialog.customer.notConfigured")}</p>
                  ) : otherPartyOptions.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("addDealDialog.customer.noneTagged")}</p>
                  ) : (
                    <SearchSelect
                      value={partyValue(otherParty)}
                      onChange={handleOtherPartyChange}
                      options={otherPartyOptions}
                      placeholder="Not set — search companies and contacts..."
                      searchPlaceholder="Search by name..."
                    />
                  )}
                </div>

                {otherParty?.kind === "company" && (
                  <div className="mb-[18px]">
                    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                      Primary Contact
                    </label>
                    <SearchSelect
                      value={values.primaryContactId}
                      onChange={(val) => setField("primaryContactId", val)}
                      options={primaryContactOptions}
                      placeholder={companyContacts.length > 0 ? "Select a contact..." : "No contacts at this company yet"}
                      searchPlaceholder="Search contacts..."
                      disabled={companyContacts.length === 0}
                    />
                  </div>
                )}

                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Department
                  </label>
                  <SearchSelect
                    value={values.departmentId}
                    onChange={(val) => setField("departmentId", val)}
                    options={departmentOptions}
                    placeholder="Search departments..."
                    searchPlaceholder="Search by name..."
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Timeline & Pain Points */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Timeline & Pain Points</span>
              </div>
              <div className="space-y-1">
                <CountrySelect
                  label="Deal Country"
                  value={values.dealCountry}
                  onChange={(val) => {
                    setField("dealCountry", val);
                    // Auto-set currency to the country's primary currency if
                    // the user hasn't already chosen a non-USD currency
                    if (val) {
                      const suggestedCurrency = COUNTRY_CURRENCY_MAP[val];
                      if (suggestedCurrency && CURRENCIES.includes(suggestedCurrency)) {
                        setField("currency", suggestedCurrency);
                      }
                    }
                  }}
                  placeholder="Search countries..."
                />

                <TextField
                  label="Expected Deadline"
                  name="expectedCloseDate"
                  type="date"
                  min={todayISO}
                  value={values.expectedCloseDate}
                  error={errors.expectedCloseDate}
                  onChange={(e) => setField("expectedCloseDate", e.target.value)}
                />

                <div className="mb-[18px]">
                  <label
                    htmlFor="customerPainPoint"
                    className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]"
                  >
                    Customer Pain Point
                  </label>
                  <textarea
                    id="customerPainPoint"
                    className={TEXTAREA_CLASS}
                    rows={4}
                    value={values.customerPainPoint}
                    placeholder="What problem is the customer trying to solve?"
                    onChange={(e) => setField("customerPainPoint", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tender ────────────────────────────────────── */}
        {activeTab === "tender" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
            {/* Card 1: Tender Details */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-500"><LegalIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Tender Identity</span>
              </div>
              <div className="space-y-1">
                <TextField
                  label="Tender Reference Number *"
                  name="tenderReference"
                  value={values.tenderReference}
                  error={errors.tenderReference}
                  placeholder="e.g. TND-2026-0142"
                  onChange={(e) => setField("tenderReference", e.target.value)}
                />

                <TextField
                  label="Issuing Body *"
                  name="issuingBody"
                  value={values.issuingBody}
                  error={errors.issuingBody}
                  placeholder="e.g. Ministry of Health"
                  onChange={(e) => setField("issuingBody", e.target.value)}
                />
              </div>
            </div>

            {/* Card 2: Submission & Evaluation */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Tender Specs</span>
              </div>
              <div className="space-y-1">
                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Submission Mode
                  </label>
                  <CustomSelect
                    fullWidth
                    label=""
                    value={values.submissionMode}
                    onChange={(val) => setField("submissionMode", val as SubmissionMode | "")}
                    options={SUBMISSION_MODE_OPTIONS}
                  />
                </div>

                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Evaluation Type
                  </label>
                  <CustomSelect
                    fullWidth
                    label=""
                    value={values.evaluationType}
                    onChange={(val) => setField("evaluationType", val as EvaluationType | "")}
                    options={EVALUATION_TYPE_OPTIONS}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Bid Security & EMD */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-550"><FinanceIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Bid Security & Financials</span>
              </div>
              <div className="space-y-1">
                <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
                  <input
                    type="checkbox"
                    checked={values.bidBondRequired}
                    onChange={(e) => setField("bidBondRequired", e.target.checked)}
                  />
                  <span className="font-semibold">Bid Bond Required</span>
                </label>

                {values.bidBondRequired && (
                  <TextField
                    label="Bid Bond Amount"
                    name="bidBondAmount"
                    type="text"
                    value={values.bidBondAmount}
                    placeholder="0"
                    onChange={(e) => setField("bidBondAmount", e.target.value)}
                  />
                )}

                <TextField
                  label="EMD Amount"
                  name="emdAmount"
                  type="text"
                  value={values.emdAmount}
                  placeholder="0"
                  onChange={(e) => setField("emdAmount", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Delivery ──────────────────────────────────── */}
        {activeTab === "delivery" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
            {/* Card 1: Scope & Solutions */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Scope & Solutions</span>
              </div>
              <div className="space-y-1">
                <TextField
                  label="Product"
                  name="product"
                  value={values.product}
                  placeholder="e.g. Nexus CRM Enterprise"
                  onChange={(e) => setField("product", e.target.value)}
                />

                <TextField
                  label="Services"
                  name="services"
                  value={values.services}
                  placeholder="e.g. Implementation, Training"
                  onChange={(e) => setField("services", e.target.value)}
                />
              </div>
            </div>

            {/* Card 2: Collaboration */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-500"><UsersGroupIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Partners & Alliances</span>
              </div>
              <div className="space-y-1">
                <div className="mb-[18px]">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Partners (Companies or Contacts)
                  </label>
                  {isEdit ? (
                    <>
                      {existingPartners.length > 0 && (
                        <div className="mb-3 flex flex-col gap-2">
                          {existingPartners.map((partner) => (
                            <div
                              key={partner.id}
                              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 transition-colors duration-150"
                            >
                              {partner.kind === "company" ? <BuildingIcon size={14} /> : <UserIcon size={14} />}
                              <span className="flex-1 text-[13.5px] font-semibold text-crm-text">{partner.name}</span>
                              {partner.subtitle && (
                                <span className="text-[12px] text-[var(--color-text-muted)]">{partner.subtitle}</span>
                              )}
                              <button
                                type="button"
                                className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                                aria-label={`Remove ${partner.name}`}
                                onClick={() => removeExistingPartner(partner.id)}
                              >
                                <TrashIcon size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {!partnerParties.configured ? (
                        <p className="text-[12.5px] text-[var(--color-danger)]">{t("addDealDialog.partners.notConfigured")}</p>
                      ) : partnerOptions.length === 0 ? (
                        <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("addDealDialog.partners.noneTagged")}</p>
                      ) : (
                        <SearchSelect
                          value=""
                          onChange={handleAddExistingPartner}
                          options={partnerOptions}
                          placeholder="Add a partner..."
                          searchPlaceholder="Search by name..."
                        />
                      )}
                    </>
                  ) : !partnerParties.configured ? (
                    <p className="text-[12.5px] text-[var(--color-danger)]">{t("addDealDialog.partners.notConfigured")}</p>
                  ) : partnerParties.companies.length === 0 && partnerParties.contacts.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("addDealDialog.partners.noneTagged")}</p>
                  ) : (
                    <MultiSelect
                      values={partnerValues}
                      onChange={setPartnerValues}
                      options={partnerOptions}
                      placeholder="Select partner companies or contacts..."
                      searchPlaceholder="Search by name..."
                      addNewLabel="Add New"
                      onAddNew={openAddParty}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Costing ───────────────────────────────────── */}
        {activeTab === "costing" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
            {/* Card 1: Costing Inputs */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-550"><FinanceIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Costing Inputs</span>
              </div>
              <div className="space-y-1">
                <CurrencySelect
                  label="Currency"
                  value={values.currency}
                  onChange={(val) => setField("currency", val)}
                />

                <TextField
                  label={`Project Value without Tax (${values.currency})`}
                  name="projectValue"
                  type="text"
                  value={values.projectValue}
                  placeholder="0"
                  onChange={(e) => setField("projectValue", e.target.value)}
                />

                <TextField
                  label={`Internal Costs (${values.currency})`}
                  name="internalCosts"
                  type="text"
                  value={values.internalCosts}
                  placeholder="0"
                  onChange={(e) => setField("internalCosts", e.target.value)}
                />

                <TextField
                  label={`External Costs (${values.currency})`}
                  name="externalCosts"
                  type="text"
                  value={values.externalCosts}
                  placeholder="0"
                  onChange={(e) => setField("externalCosts", e.target.value)}
                />
              </div>
            </div>

            {/* Card 2: Financial Metrics */}
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Financial Metrics</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="totalCost" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Total Cost ({values.currency})
                  </label>
                  <input
                    id="totalCost"
                    readOnly
                    value={formatLkr(costing.totalCost)}
                    className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-100/60 px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
                  />
                </div>

                <div>
                  <label htmlFor="profit" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Profit ({values.currency})
                  </label>
                  <input
                    id="profit"
                    readOnly
                    value={formatLkr(costing.profit)}
                    className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-100/60 px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
                  />
                </div>

                <div>
                  <label htmlFor="markup" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Project Profit Markup
                  </label>
                  <input
                    id="markup"
                    readOnly
                    value={formatPercent(costing.markupPercent)}
                    className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-100/60 px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
                  />
                </div>

                <div>
                  <label htmlFor="margin" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                    Project Profit Margin
                  </label>
                  <input
                    id="margin"
                    readOnly
                    value={formatPercent(costing.marginPercent)}
                    className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-100/60 px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Competition ───────────────────────────────── */}
        {activeTab === "competition" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
            <Button
              type="button"
              variant="secondary"
              className="btn-add w-full justify-center border-dashed border-2 hover:bg-slate-50 mb-4"
              onClick={addCompetitor}
            >
              <PlusIcon size={14} /> Add Competitor
            </Button>

            {competitors.length === 0 ? (
              <p className="deal-empty-tab bg-slate-50/30 rounded-xl border border-dashed border-slate-200 py-6 text-center">
                No competitors added yet. Add who else the customer is considering.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {competitors.map((competitor, index) => (
                  <div
                    key={competitor.id}
                    className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80"
                  >
                    <div className="flex items-center justify-between text-[13px] font-bold text-crm-text mb-3 pb-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Competitor #{index + 1}
                      </span>
                      <button
                        type="button"
                        className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                        aria-label={`Remove competitor ${index + 1}`}
                        onClick={() => removeCompetitor(competitor.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                    <TextField
                      label="Competitor Name"
                      id={`competitor-name-${competitor.id}`}
                      value={competitor.name}
                      onChange={(e) => updateCompetitor(competitor.id, "name", e.target.value)}
                      placeholder="e.g. Acme Corp"
                    />
                    <div className="mb-[18px]">
                      <label
                        htmlFor={`competitor-details-${competitor.id}`}
                        className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]"
                      >
                        Details
                      </label>
                      <textarea
                        id={`competitor-details-${competitor.id}`}
                        className={TEXTAREA_CLASS}
                        rows={4}
                        value={competitor.details}
                        placeholder="Pricing, strengths/weaknesses, why the customer is considering them..."
                        onChange={(e) => updateCompetitor(competitor.id, "details", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Team ──────────────────────────────────────── */}
        {activeTab === "team" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
            <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
              <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                <span className="text-slate-550"><UsersGroupIcon size={14} /></span>
                <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Deal Team Assignment</span>
              </div>
              <div className="space-y-1">
                {dealRoles.map((role) => {
                  const isSalesPerson = role.id === salesPersonRoleId;
                  const teammates = existingAssignments.filter((a) => a.roleId === role.id && !a.isPrimary);
                  const assignedIds = assignedUserIdsForRole(role.id);
                  const addOptions = baseUserOptions.filter((o) => !assignedIds.has(o.value));

                  return (
                    <div key={role.id} className="mb-[18px]">
                      <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                        {role.name}
                        {isSalesPerson ? " (Primary) *" : ""}
                      </label>

                      {isSalesPerson && (
                        <>
                          <SearchSelect
                            value={values.salesPersonUserId}
                            onChange={(val) => (isEdit ? handleChangePrimarySalesPerson(val) : setField("salesPersonUserId", val))}
                            options={salesPersonPrimaryOptions}
                            placeholder="Search people..."
                            searchPlaceholder="Search by name..."
                          />
                          {errors.salesPersonUserId && (
                            <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{errors.salesPersonUserId}</p>
                          )}
                          <p className="mt-1.5 mb-2 text-[12px] text-[var(--color-text-muted)]">
                            Responsible for this deal. Add more Sales Person teammates below.
                          </p>
                        </>
                      )}

                       {isEdit ? (
                        <MultiSelect
                          values={teammates.map((a) => a.userId)}
                          onChange={async (nextUserIds) => {
                            const regularUserIds = teammates.map((a) => a.userId);
                            const addedIds = nextUserIds.filter((id) => !regularUserIds.includes(id));
                            for (const userId of addedIds) {
                              await handleAssignRole(role.id, userId);
                            }
                            const removed = teammates.filter((a) => !nextUserIds.includes(a.userId));
                            for (const assignment of removed) {
                              await handleRemoveAssignment(assignment.id);
                            }
                          }}
                          options={isSalesPerson ? baseUserOptions.filter((o) => o.value !== values.salesPersonUserId) : baseUserOptions}
                          placeholder={isSalesPerson ? "Add another Sales Person..." : `Add to ${role.name}...`}
                          searchPlaceholder="Search by name..."
                        />
                      ) : (
                        <MultiSelect
                          values={roleAssignmentValues[role.id] ?? []}
                          onChange={(vals) => setRoleAssignmentValues((prev) => ({ ...prev, [role.id]: vals }))}
                          options={isSalesPerson ? addOptions : baseUserOptions}
                          placeholder={isSalesPerson ? "Add another Sales Person..." : `Add to ${role.name}...`}
                          searchPlaceholder="Search by name..."
                        />
                      )}
                    </div>
                  );
                })}

                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="New role name (e.g. Delivery Lead)"
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 focus:outline-none focus:border-crm-primary focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)]"
                  />
                  <Button type="button" variant="secondary" onClick={handleAddRole} disabled={isAddingRole || !newRoleName.trim()}>
                    <PlusIcon size={14} /> Add Role
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Documents ─────────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
            <div
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13.5px] transition-all duration-150 ${
                isDropActive 
                  ? "border-crm-primary bg-red-50/30" 
                  : "border-slate-200 bg-slate-50/30 hover:border-slate-350 hover:bg-slate-50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDropActive(true);
              }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={handleDrop}
            >
              <span className="text-slate-400"><UploadCloudIcon size={26} /></span>
              <span className="font-semibold text-slate-700">
                {isEdit && isUploadingDocs ? "Uploading…" : "Click to upload or drag and drop"}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {isEdit ? "Set a name/version, then click Upload" : "Uploaded once you create the deal"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {documents.length > 0 && (
              <div className="mt-4 flex flex-col gap-2.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition-colors duration-150">
                      <span className="flex flex-shrink-0 text-crm-primary">
                        <FileIcon size={18} />
                      </span>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="truncate text-[13.5px] font-semibold text-crm-text">
                          {doc.name || doc.file.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                          {doc.version ? `v${doc.version}` : "v1.0"}
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setEditingDocId(editingDocId === doc.id ? null : doc.id)}
                        className={`flex flex-shrink-0 cursor-pointer rounded-md border-0 p-1.5 transition-colors duration-150 ${
                          editingDocId === doc.id 
                            ? "bg-crm-primary-tint text-crm-primary"
                            : "bg-transparent text-[var(--color-text-muted)] hover:bg-slate-100"
                        }`}
                        aria-label="Edit Details"
                        title="Edit Details"
                      >
                        <EditIcon size={14} />
                      </button>

                      {isEdit && (
                        <button
                          type="button"
                          disabled={isUploadingDocs}
                          className="flex-shrink-0 rounded-md border-0 bg-crm-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-crm-primary-hover disabled:opacity-50"
                          onClick={() => uploadStagedDocument(doc.id)}
                        >
                          Upload
                        </button>
                      )}
                      <button
                        type="button"
                        className="flex flex-shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                        aria-label={`Remove ${doc.file.name}`}
                        onClick={() => removeDocument(doc.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        editingDocId === doc.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-slate-100 bg-slate-50/50 p-3 flex items-start gap-3">
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Document Name</label>
                              <input
                                type="text"
                                value={doc.name}
                                placeholder={doc.file.name}
                                onChange={(e) => updateStagedDocument(doc.id, "name", e.target.value)}
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-crm-text focus:outline-none focus:border-crm-primary focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)] transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Version</label>
                              <input
                                type="text"
                                value={doc.version}
                                placeholder="1.0"
                                onChange={(e) => updateStagedDocument(doc.id, "version", e.target.value)}
                                className="w-32 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-crm-text focus:outline-none focus:border-crm-primary focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)] transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isEdit && existingDocuments.length > 0 && (
              <div className="mt-4 flex flex-col gap-2.5">
                {existingDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 hover:border-slate-300 transition-colors duration-150"
                  >
                    <span className="flex flex-shrink-0 text-crm-primary">
                      <FileIcon size={18} />
                    </span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 no-underline"
                    >
                      <div className="overflow-hidden truncate text-[13.5px] font-bold text-crm-text">
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {doc.docType}{doc.version ? ` · ${doc.version}` : ""}
                      </div>
                    </a>
                    <button
                      type="button"
                      className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                      aria-label={`Remove ${doc.title}`}
                      onClick={() => removeExistingDocument(doc.id)}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────── */}
        {activeTab === "notes" && (
          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
                <p className="text-[13.5px] font-medium text-[var(--color-text)]">No notes yet</p>
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Start the conversation below.</p>
              </div>
            ) : (
              <div className="mb-5 flex flex-col gap-5">
                {notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-crm-primary text-[12.5px] font-bold tracking-[0.02em] text-white"
                      aria-hidden="true"
                    >
                      {getInitials(note.author)}
                    </div>
                    <div className="min-w-0 max-w-[75%] rounded-tl-[6px] rounded-tr-[18px] rounded-bl-[18px] rounded-br-[18px] bg-crm-primary-tint px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-[var(--color-text)]">{note.author}</span>
                        <span className="flex-1 text-[11.5px] text-[var(--color-text-muted)]">
                          {formatNoteTime(note.createdAt)}
                        </span>
                        {note.author === CURRENT_USER_LABEL && editingNoteId !== note.id && (
                          <>
                            <button
                              type="button"
                              className="flex flex-shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-[5px] text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-white hover:text-crm-primary"
                              aria-label="Edit note"
                              onClick={() => startEditNote(note)}
                            >
                              <EditIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="flex flex-shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-[5px] text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                              aria-label="Delete note"
                              onClick={() => deleteNote(note.id)}
                            >
                              <TrashIcon size={14} />
                            </button>
                          </>
                        )}
                      </div>

                      {editingNoteId === note.id ? (
                        <>
                          <textarea
                            className={TEXTAREA_CLASS}
                            rows={3}
                            value={editNoteDraft}
                            onChange={(e) => setEditNoteDraft(e.target.value)}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <Button type="button" variant="secondary" onClick={cancelEditNote}>
                              Cancel
                            </Button>
                            <Button type="button" onClick={() => saveEditNote(note.id)}>
                              Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--color-text)]">{note.text}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={notesEndRef} />

            <div className="flex items-start gap-3 border-t border-[var(--color-border)] pt-4">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-crm-primary text-[12.5px] font-bold tracking-[0.02em] text-white"
                aria-hidden="true"
              >
                {getInitials(CURRENT_USER_LABEL)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <textarea
                  className={TEXTAREA_CLASS}
                  rows={3}
                  placeholder="Write a note... (Enter to send, Shift+Enter for a new line)"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      postNote();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={postNote} disabled={!draftNote.trim()}>
                    Post Note
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2.5 border-t border-slate-200/60 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEdit ? "Save changes" : "Create deal"}
          </Button>
        </div>
      </form>

      {/* ── Add New Party flow ──────────────────────────── */}
      {addPartyState?.step === "type" && (
        <ChooseRelationshipTypeDialog
          title="Add New Party"
          relationshipTypes={relationshipTypes}
          onClose={() => setAddPartyState(null)}
          onSelect={(rt) => setAddPartyState({ step: "kind", relationshipTypeId: rt.id, relationshipTypeName: rt.name })}
        />
      )}

      {addPartyState?.step === "kind" && (
        <Dialog open title="Add New Party" onClose={() => setAddPartyState(null)} maxWidth="420px">
          <p className="mb-4 text-[var(--color-text-muted)]">Is this a company or an individual person?</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--color-crm-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-crm-primary-hover)]"
              onClick={() =>
                setAddPartyState({
                  step: "company",
                  relationshipTypeId: addPartyState.relationshipTypeId,
                  relationshipTypeName: addPartyState.relationshipTypeName,
                })
              }
            >
              <BuildingIcon size={16} /> Company
            </button>
            <button
              type="button"
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--color-crm-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-crm-primary-hover)]"
              onClick={() =>
                setAddPartyState({
                  step: "contact",
                  relationshipTypeId: addPartyState.relationshipTypeId,
                  relationshipTypeName: addPartyState.relationshipTypeName,
                })
              }
            >
              <UserIcon size={16} /> Person
            </button>
          </div>
        </Dialog>
      )}

      {addPartyState?.step === "company" && (
        <CompanyFormDialog
          mode="create"
          relationshipTypeId={addPartyState.relationshipTypeId}
          relationshipTypeName={addPartyState.relationshipTypeName}
          industries={industries}
          employees={employees}
          companies={companies}
          onClose={() => setAddPartyState(null)}
          onSaved={handlePartySaved}
        />
      )}

      {addPartyState?.step === "contact" && (
        <ContactFormDialog
          mode="create"
          relationshipTypeId={addPartyState.relationshipTypeId}
          relationshipTypeName={addPartyState.relationshipTypeName}
          companies={companies}
          onClose={() => setAddPartyState(null)}
          onSaved={handlePartySaved}
        />
      )}
    </Dialog>
  );
}
