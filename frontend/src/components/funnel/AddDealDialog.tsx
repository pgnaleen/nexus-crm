"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
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
  type DealSourceResponse,
  type DepartmentPickerResponse,
  type EmployeePickerResponse,
  type IndustryResponse,
  type RelationshipRolePickerResponse,
  type RelationshipTypeResponse,
} from "@orelia/common";
import {
  addDealPartnerCompany,
  addDealPartnerContact,
  createDeal,
  createDealNote,
  deleteDealDocument,
  getDealTenderDetails,
  listDealDocuments,
  listDealPartners,
  removeDealPartner,
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
import { computeCosting, formatBytes, formatLkr, formatNoteTime, formatPercent, getInitials } from "@/lib/deals/deal-display";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { BuildingIcon, EditIcon, FileIcon, TrashIcon, UploadCloudIcon, UserIcon } from "@/components/ui/icons";
import { minDate, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";
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
  // Team tab -- salesPersonId is sent as the deal's `ownerId`; Pre-Sales and
  // PMO are sent as their own preSalesPersonId/pmoId columns.
  salesPersonId: string;
  preSalesPersonId: string;
  pmoId: string;
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
    projectValue: deal?.estimatedValue != null ? String(deal.estimatedValue) : "",
    internalCosts: deal?.internalCosts != null ? String(deal.internalCosts) : "",
    externalCosts: deal?.externalCosts != null ? String(deal.externalCosts) : "",
    salesPersonId: deal?.ownerId ?? "",
    preSalesPersonId: deal?.preSalesPersonId ?? "",
    pmoId: deal?.pmoId ?? "",
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
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(
    () => deal?.competitors?.map((c) => ({ id: crypto.randomUUID(), name: c.name, details: c.details })) ?? [],
  );
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteDraft, setEditNoteDraft] = useState("");
  const [partnerValues, setPartnerValues] = useState<string[]>([]);
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
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  useEffect(() => {
    if (!isEdit || !deal) return;
    let cancelled = false;
    Promise.all([listDealDocuments(deal.id), listDealPartners(deal.id)])
      .then(([docsRes, partnersRes]) => {
        if (cancelled) return;
        setExistingDocuments(docsRes);
        setExistingPartners(partnersRes);
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
          bidBondAmount: row.bidBondAmount != null ? String(row.bidBondAmount) : "",
          emdAmount: row.emdAmount != null ? String(row.emdAmount) : "",
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
    setValues((current) => ({ ...current, [field]: value }));
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
    if (!values.salesPersonId) nextErrors.salesPersonId = "Sales Person is required";
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
    } else if (nextErrors.salesPersonId) {
      setActiveTab("team");
    }

    return Object.keys(nextErrors).length === 0;
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    if (isEdit && deal) {
      setIsUploadingDocs(true);
      try {
        for (const file of Array.from(fileList)) {
          const doc = await uploadDealDocument(deal.id, file, { docType: DocumentType.Other, title: file.name });
          setExistingDocuments((prev) => [...prev, doc]);
        }
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : "Failed to upload document");
      } finally {
        setIsUploadingDocs(false);
      }
      return;
    }

    const next = Array.from(fileList).map((file) => ({ id: crypto.randomUUID(), file }));
    setDocuments((prev) => [...prev, ...next]);
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
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
      bidBondAmount: values.bidBondAmount.trim() ? Number(values.bidBondAmount) : undefined,
      emdAmount: values.emdAmount.trim() ? Number(values.emdAmount) : undefined,
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
          ownerId: values.salesPersonId,
          preSalesPersonId: values.preSalesPersonId || undefined,
          pmoId: values.pmoId || undefined,
          departmentId: values.departmentId || undefined,
          dealCountry: values.dealCountry || undefined,
          customerPainPoint: values.customerPainPoint || undefined,
          expectedCloseDate: values.expectedCloseDate || undefined,
          product: values.product || undefined,
          services: values.services || undefined,
          estimatedValue: values.projectValue ? Number(values.projectValue) : undefined,
          internalCosts: values.internalCosts ? Number(values.internalCosts) : undefined,
          externalCosts: values.externalCosts ? Number(values.externalCosts) : undefined,
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
        // Sales Person is the UI-facing replacement for the old Owner field --
        // the backend still only has one `ownerId` column, so it's sent here.
        ownerId: values.salesPersonId,
        preSalesPersonId: values.preSalesPersonId || undefined,
        pmoId: values.pmoId || undefined,
        mainStageId: values.mainStageId,
        currentStageId: values.currentStageId || undefined,
        departmentId: values.departmentId || undefined,
        dealCountry: values.dealCountry || undefined,
        customerPainPoint: values.customerPainPoint || undefined,
        expectedCloseDate: values.expectedCloseDate || undefined,
        product: values.product || undefined,
        services: values.services || undefined,
        estimatedValue: values.projectValue ? Number(values.projectValue) : undefined,
        internalCosts: values.internalCosts ? Number(values.internalCosts) : undefined,
        externalCosts: values.externalCosts ? Number(values.externalCosts) : undefined,
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
          uploadDealDocument(createdDeal.id, doc.file, { docType: DocumentType.Other, title: doc.file.name }),
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

  const baseEmployeeOptions: SearchSelectOption[] = employees.map((e) => ({ value: e.id, label: e.fullName }));
  // The picker excludes exited (terminated/resigned) employees. When editing a
  // deal whose Sales Person / Pre-Sales / PMO has since been made inactive, that
  // person is no longer in `employees` -- append them so their own field keeps
  // showing its current value instead of going blank. Each of the three roles
  // gets its own options list (not one shared list) so a terminated ex-Sales
  // Person re-appended for the Sales Person field doesn't leak into the
  // Pre-Sales/PMO dropdowns as a newly pickable option -- they were never
  // assigned to those roles, so they must not appear there at all. (Within its
  // own field, the re-appended entry can't be re-selected once cleared --
  // that's intended.)
  function withCurrentValueFallback(currentId: string | null | undefined, currentName: string | null | undefined): SearchSelectOption[] {
    if (!currentId || baseEmployeeOptions.some((o) => o.value === currentId)) {
      return baseEmployeeOptions;
    }
    return [...baseEmployeeOptions, { value: currentId, label: currentName ?? "Unknown" }];
  }

  const salesPersonOptions = deal ? withCurrentValueFallback(deal.ownerId, deal.ownerName) : baseEmployeeOptions;
  const preSalesPersonOptions = deal ? withCurrentValueFallback(deal.preSalesPersonId, deal.preSalesPersonName) : baseEmployeeOptions;
  const pmoOptions = deal ? withCurrentValueFallback(deal.pmoId, deal.pmoName) : baseEmployeeOptions;
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
    setAddPartyState(relationshipTypes.length === 1 ? { step: "kind", relationshipTypeId: relationshipTypes[0].id, relationshipTypeName: relationshipTypes[0].name } : { step: "type" });
  }

  function handlePartySaved() {
    void refreshPickers();
    setAddPartyState(null);
  }

  const documentCount = isEdit ? existingDocuments.length : documents.length;
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

  return (
    <Dialog open title={isEdit ? deal?.name ?? "Edit Deal" : "Add New Deal"} onClose={onClose} maxWidth="720px">
      <form onSubmit={handleSubmit}>
        {/* Single row, never wrapping or squashing -- mirrors ViewDealDialog's
            tab strip. Tabs keep their natural width (shrink-0) and the strip
            scrolls horizontally when all 8 no longer fit the 720px dialog. */}
        <div className="-mx-5 -mt-5 mb-5 flex flex-nowrap gap-x-4 overflow-x-auto border-b border-[var(--color-border)] px-5">
          {tabDefs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`shrink-0 cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent px-1 py-3 text-[13.5px] font-semibold transition-colors duration-150 hover:text-[var(--color-text)] ${
                activeTab === id
                  ? "border-b-[var(--color-crm-primary)] text-[var(--color-crm-primary)]"
                  : "border-b-transparent text-[var(--color-text-muted)]"
              }`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        {/* ── Deal Information ──────────────────────────── */}
        {activeTab === "dealInfo" && (
          <div className="h-[620px] overflow-y-auto pr-1">
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
              <span>This is a Tender deal</span>
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
                    // Changing Main Stage invalidates whichever Sub Stage was
                    // picked, if any -- it belonged to the previous Main Stage.
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

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Customer (Company or Contact)
              </label>
              {!customerParties.configured ? (
                <p className="text-[12.5px] text-[var(--color-danger)]">{t("addDealDialog.customer.notConfigured")}</p>
              ) : otherPartyOptions.length === 0 ? (
                <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("addDealDialog.customer.noneTagged")}</p>
              ) : (
                <>
                  <SearchSelect
                    value={partyValue(otherParty)}
                    onChange={handleOtherPartyChange}
                    options={otherPartyOptions}
                    placeholder="Not set — search companies and contacts..."
                    searchPlaceholder="Search by name..."
                  />
                </>
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

            <CountrySelect
              label="Deal Country"
              value={values.dealCountry}
              onChange={(val) => setField("dealCountry", val)}
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
        )}

        {/* ── Tender ────────────────────────────────────── */}
        {activeTab === "tender" && (
          <div className="h-[620px] overflow-y-auto pr-1">
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

            <label className="mb-[18px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-crm-text">
              <input
                type="checkbox"
                checked={values.bidBondRequired}
                onChange={(e) => setField("bidBondRequired", e.target.checked)}
              />
              <span>Bid Bond Required</span>
            </label>

            {values.bidBondRequired && (
              <TextField
                label="Bid Bond Amount"
                name="bidBondAmount"
                type="number"
                min="0"
                value={values.bidBondAmount}
                placeholder="0"
                onChange={(e) => setField("bidBondAmount", e.target.value)}
              />
            )}

            <TextField
              label="EMD Amount"
              name="emdAmount"
              type="number"
              min="0"
              value={values.emdAmount}
              placeholder="0"
              onChange={(e) => setField("emdAmount", e.target.value)}
            />

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
        )}

        {/* ── Delivery ──────────────────────────────────── */}
        {activeTab === "delivery" && (
          <div className="h-[620px] overflow-y-auto pr-1">
            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Partners (Companies or Contacts)
              </label>
              {isEdit ? (
                <>
                  {existingPartners.length > 0 && (
                    <div className="mb-2 flex flex-col gap-2">
                      {existingPartners.map((partner) => (
                        <div
                          key={partner.id}
                          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                        >
                          {partner.kind === "company" ? <BuildingIcon size={14} /> : <UserIcon size={14} />}
                          <span className="flex-1 text-[13.5px] text-[var(--color-text)]">{partner.name}</span>
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
        )}

        {/* ── Costing ───────────────────────────────────── */}
        {activeTab === "costing" && (
          <div className="h-[620px] overflow-y-auto pr-1">
            <CurrencySelect
              label="Currency"
              value={values.currency}
              onChange={(val) => setField("currency", val)}
            />

            <TextField
              label={`Project Value without Tax (${values.currency})`}
              name="projectValue"
              type="number"
              min="0"
              value={values.projectValue}
              placeholder="0"
              onChange={(e) => setField("projectValue", e.target.value)}
            />

            <TextField
              label={`Internal Costs (${values.currency})`}
              name="internalCosts"
              type="number"
              min="0"
              value={values.internalCosts}
              placeholder="0"
              onChange={(e) => setField("internalCosts", e.target.value)}
            />

            <TextField
              label={`External Costs (${values.currency})`}
              name="externalCosts"
              type="number"
              min="0"
              value={values.externalCosts}
              placeholder="0"
              onChange={(e) => setField("externalCosts", e.target.value)}
            />

            <div className="mb-[18px]">
              <label htmlFor="totalCost" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Total Cost ({values.currency})
              </label>
              <input
                id="totalCost"
                readOnly
                value={formatLkr(costing.totalCost)}
                className="w-full cursor-default rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
              />
            </div>

            <div className="mb-[18px]">
              <label htmlFor="profit" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Profit ({values.currency})
              </label>
              <input
                id="profit"
                readOnly
                value={formatLkr(costing.profit)}
                className="w-full cursor-default rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
              />
            </div>

            <div className="mb-[18px]">
              <label htmlFor="markup" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Project Profit Markup
              </label>
              <input
                id="markup"
                readOnly
                value={formatPercent(costing.markupPercent)}
                className="w-full cursor-default rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
              />
            </div>

            <div className="mb-[18px]">
              <label htmlFor="margin" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Project Profit Margin
              </label>
              <input
                id="margin"
                readOnly
                value={formatPercent(costing.marginPercent)}
                className="w-full cursor-default rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
              />
            </div>
          </div>
        )}

        {/* ── Competition ───────────────────────────────── */}
        {/* Persisted as a single jsonb column on the deal (Deal.competitors) --
            just a list of free-text blurbs with no need to query/filter on
            individually. */}
        {activeTab === "competition" && (
          <div className="h-[620px] overflow-y-auto pr-1">
            <div className="mb-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={addCompetitor}>
                + Add Competitor
              </Button>
            </div>

            {competitors.length === 0 ? (
              <p className="text-[var(--color-text-muted)]">
                No competitors added yet. Click &quot;Add Competitor&quot; to note who else the customer is
                considering.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {competitors.map((competitor, index) => (
                  <div
                    key={competitor.id}
                    className="flex flex-col gap-2.5 rounded-lg border border-[var(--color-border)] bg-white p-[14px]"
                  >
                    <div className="flex items-center justify-between text-[13px] font-semibold text-[var(--color-text)]">
                      <span>Competitor {index + 1}</span>
                      <button
                        type="button"
                        className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                        aria-label={`Remove competitor ${index + 1}`}
                        onClick={() => removeCompetitor(competitor.id)}
                      >
                        <TrashIcon size={16} />
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
          <div className="h-[620px] overflow-y-auto pr-1">
            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Sales Person *
              </label>
              <SearchSelect
                value={values.salesPersonId}
                onChange={(val) => setField("salesPersonId", val)}
                options={salesPersonOptions}
                placeholder="Search employees..."
                searchPlaceholder="Search by name..."
              />
              {errors.salesPersonId && (
                <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{errors.salesPersonId}</p>
              )}
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Pre-Sales Person
              </label>
              <SearchSelect
                value={values.preSalesPersonId}
                onChange={(val) => setField("preSalesPersonId", val)}
                options={preSalesPersonOptions}
                placeholder="Search employees..."
                searchPlaceholder="Search by name..."
              />
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">PMO</label>
              <SearchSelect
                value={values.pmoId}
                onChange={(val) => setField("pmoId", val)}
                options={pmoOptions}
                placeholder="Search employees..."
                searchPlaceholder="Search by name..."
              />
            </div>
          </div>
        )}

        {/* ── Documents ─────────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="h-[620px] overflow-y-auto pr-1">
            <div
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border-[1.5px] border-dashed px-4 py-[30px] text-center text-[13.5px] font-medium text-[var(--color-text)] transition-colors duration-150 hover:border-[var(--color-brand)] hover:bg-[#eef4ff] ${
                isDropActive ? "border-[var(--color-brand)] bg-[#eef4ff]" : "border-[var(--color-border)] bg-[#f8fafc]"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDropActive(true);
              }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={handleDrop}
            >
              <UploadCloudIcon size={26} />
              <span>{isEdit && isUploadingDocs ? "Uploading…" : "Click to upload or drag and drop"}</span>
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                {isEdit ? "Uploaded immediately" : "Uploaded once you create the deal below"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {isEdit
              ? existingDocuments.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {existingDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5"
                      >
                        <span className="flex flex-shrink-0 text-[var(--color-brand)]">
                          <FileIcon size={18} />
                        </span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 no-underline"
                        >
                          <div className="overflow-hidden truncate text-[13.5px] font-medium text-[var(--color-text)]">
                            {doc.title}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">{doc.docType}</div>
                        </a>
                        <button
                          type="button"
                          className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                          aria-label={`Remove ${doc.title}`}
                          onClick={() => removeExistingDocument(doc.id)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              : documents.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5"
                      >
                        <span className="flex flex-shrink-0 text-[var(--color-brand)]">
                          <FileIcon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="overflow-hidden truncate text-[13.5px] font-medium text-[var(--color-text)]">
                            {doc.file.name}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">{formatBytes(doc.file.size)}</div>
                        </div>
                        <button
                          type="button"
                          className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                          aria-label={`Remove ${doc.file.name}`}
                          onClick={() => removeDocument(doc.id)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────── */}
        {/* Comment-thread style: everyone who can see this deal can see every
            note, but only the note's own author can edit it again -- the
            backend enforces this too (POST /deals/:id/notes, PATCH
            /deals/:id/notes/:noteId). This dialog only ever creates a
            brand-new deal, so drafts are composed locally (there's no deal
            to attach them to yet) and posted for real right after the deal
            itself is created, below in handleSubmit. Every note posted here
            is authored by CURRENT_USER_LABEL locally -- the edit check is
            still written against that label (not skipped) so the same code
            keeps working once this is reused for editing notes on an
            existing deal, where other users' names would actually appear. */}
        {activeTab === "notes" && (
          <div className="h-[620px] overflow-y-auto pr-1">
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

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEdit ? "Save Changes" : "Create Deal"}
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
