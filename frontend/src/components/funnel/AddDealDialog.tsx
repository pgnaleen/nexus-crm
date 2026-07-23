"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  DealType,
  DocumentType,
  type CompanyPickerResponse,
  type ContactPickerResponse,
  type DealDocumentResponse,
  type DealPartnerResponse,
  type DealResponse,
  type DealSourceResponse,
  type DepartmentPickerResponse,
  type EmployeePickerResponse,
  type IndustryResponse,
  type RelationshipTypeResponse,
} from "@orelia/common";
import { type FunnelColumn } from "@/components/funnel/FunnelBoard";
import {
  addDealPartnerCompany,
  addDealPartnerContact,
  createDeal,
  createDealNote,
  deleteDealDocument,
  listDealDocuments,
  listDealPartners,
  removeDealPartner,
  updateDeal,
  uploadDealDocument,
} from "@/lib/api/deals";
import { listCompaniesPicker, listContactsPicker } from "@/lib/api/pickers";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/providers/ToastProvider";
import { computeCosting, formatBytes, formatLkr, formatNoteTime, formatPercent, getInitials } from "@/lib/deals/deal-display";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { BuildingIcon, EditIcon, FileIcon, TrashIcon, UploadCloudIcon, UserIcon } from "@/components/ui/icons";
import { minDate, required, validate } from "@/lib/validation";
import { CompanyFormDialog } from "@/app/[tenant]/(dashboard)/relationships/[id]/_components/CompanyFormDialog";
import { ContactFormDialog } from "@/app/[tenant]/(dashboard)/relationships/[id]/_components/ContactFormDialog";

// dealType isn't shown in the form for now, but the backend contract still
// requires one on create -- default silently to the most common case until
// the field comes back.
const DEFAULT_DEAL_TYPE = DealType.NewBusiness;

// Shared Tailwind equivalent of the app-wide `.field-textarea` class, used
// four times in this file. Kept as a constant rather than repeating the
// string, since `.field-textarea` itself stays untouched for every other
// dialog still using it until their own restyle pass.
const TEXTAREA_CLASS =
  "w-full resize-y rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] px-3 py-2.5 font-[inherit] text-sm transition-colors duration-150 focus:outline-none focus:border-[var(--color-crm-primary)] focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)]";

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
  // Silently defaulted (stages[0]), same treatment as dealType below -- the
  // backend still requires a stage on create, but the client's tab spec has
  // no place for picking one, so there's no visible field for it anymore.
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
  projectValue: string;
  internalCosts: string;
  externalCosts: string;
  // Team tab -- salesPersonId is sent as the deal's `ownerId`; Pre-Sales and
  // PMO are sent as their own preSalesPersonId/pmoId columns.
  salesPersonId: string;
  preSalesPersonId: string;
  pmoId: string;
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
  // Sub Stage options for the picker -- distinct from the board's own
  // `columns` prop on pages where the board is grouped by something other
  // than Sub Stage (e.g. the tenant-wide Funnel overview groups by Main
  // Stage). Defaults to `columns` when the board is already Sub-Stage-shaped.
  stageOptions?: FunnelColumn[];
  columns: FunnelColumn[];
  companies: CompanyPickerResponse[];
  employees: EmployeePickerResponse[];
  contacts: ContactPickerResponse[];
  departments: DepartmentPickerResponse[];
  relationshipTypes: RelationshipTypeResponse[];
  industries: IndustryResponse[];
  defaultDealSourceId?: string;
  onClose: () => void;
  onCreated?: (deal: DealResponse) => void;
  onUpdated?: (deal: DealResponse) => void;
}

export function AddDealDialog({
  mode = "create",
  deal,
  dealSources,
  stageOptions,
  columns,
  companies: initialCompanies,
  employees,
  contacts: initialContacts,
  departments,
  relationshipTypes,
  industries,
  defaultDealSourceId,
  onClose,
  onCreated,
  onUpdated,
}: AddDealDialogProps) {
  const isEdit = mode === "edit";
  const stages = stageOptions ?? columns;
  const [activeTab, setActiveTab] = useState<TabId>("dealInfo");
  const [companies, setCompanies] = useState(initialCompanies);
  const [contacts, setContacts] = useState(initialContacts);
  const [values, setValues] = useState<DetailsFormState>(() => ({
    name: deal?.name ?? "",
    isTender: deal?.isTender ?? false,
    sourceId:
      deal?.sourceId ?? (dealSources.some((s) => s.id === defaultDealSourceId) ? (defaultDealSourceId ?? "") : ""),
    primaryContactId: deal?.primaryContactId ?? "",
    currentStageId: deal?.currentStageId ?? stages[0]?.id ?? "",
    dealCountry: deal?.dealCountry ?? "",
    customerPainPoint: deal?.customerPainPoint ?? "",
    departmentId: deal?.departmentId ?? "",
    expectedCloseDate: deal?.expectedCloseDate ?? "",
    product: deal?.product ?? "",
    services: deal?.services ?? "",
    projectValue: deal?.estimatedValue != null ? String(deal.estimatedValue) : "",
    internalCosts: deal?.internalCosts != null ? String(deal.internalCosts) : "",
    externalCosts: deal?.externalCosts != null ? String(deal.externalCosts) : "",
    salesPersonId: deal?.ownerId ?? "",
    preSalesPersonId: deal?.preSalesPersonId ?? "",
    pmoId: deal?.pmoId ?? "",
  }));
  const [otherParty, setOtherParty] = useState<OtherParty | null>(() => {
    if (!deal) return null;
    if (deal.companyId) return { kind: "company", id: deal.companyId };
    if (deal.contactId) return { kind: "contact", id: deal.contactId };
    return null;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsFormState | "otherParty", string>>>({});
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

  async function refreshPickers() {
    try {
      const [freshCompanies, freshContacts] = await Promise.all([listCompaniesPicker(), listContactsPicker()]);
      setCompanies(freshCompanies);
      setContacts(freshContacts);
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
    const nextErrors: Partial<Record<keyof DetailsFormState | "otherParty", string>> = {};

    const nameError = validate(values.name, [required("Deal name is required")]);
    if (nameError) nextErrors.name = nameError;
    // Customer is locked (not editable) once a deal exists, so there's
    // nothing to validate here in edit mode -- it's always already set.
    if (!isEdit && !otherParty) nextErrors.otherParty = "Select the other party for this deal";
    if (!values.salesPersonId) nextErrors.salesPersonId = "Sales Person is required";
    // currentStageId has no visible field -- it's silently defaulted to
    // stages[0]?.id (see DetailsFormState above) -- but the backend still
    // requires a real Sub Stage on create. When there are none configured
    // yet, that default resolves to "" and would otherwise hit a generic,
    // unexplained backend 400 with no way for the user to fix it here.
    if (!isEdit && !values.currentStageId) {
      nextErrors.currentStageId = "No stages are available to create a deal in yet — add a Sub Stage first";
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

    setErrors(nextErrors);

    // Jump to whichever tab actually holds the first invalid field.
    if (nextErrors.name || nextErrors.otherParty || nextErrors.currentStageId || nextErrors.expectedCloseDate) {
      setActiveTab("dealInfo");
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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropActive(false);
    addFiles(event.dataTransfer.files);
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
          // Customer itself is locked, but which contact-at-that-company is
          // primary is still a legitimate, editable field.
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
        companyId,
        contactId,
        primaryContactId,
        sourceId: values.sourceId || undefined,
        // Sales Person is the UI-facing replacement for the old Owner field --
        // the backend still only has one `ownerId` column, so it's sent here.
        ownerId: values.salesPersonId,
        preSalesPersonId: values.preSalesPersonId || undefined,
        pmoId: values.pmoId || undefined,
        mainStageId: stages.find((s) => s.id === values.currentStageId)?.mainStageId,
        currentStageId: values.currentStageId,
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

  const companyNameById = new Map(companies.map((c) => [c.id, c.name]));
  const otherPartyOptions: SearchSelectOption[] = [
    ...companies.map((c) => ({
      value: `company:${c.id}`,
      label: c.name,
      sublabel: "Company",
      icon: <BuildingIcon size={14} />,
    })),
    ...contacts.map((c) => ({
      value: `contact:${c.id}`,
      label: c.fullName,
      sublabel: c.companyId ? companyNameById.get(c.companyId) ?? "Person" : "Person (no company)",
      icon: <UserIcon size={14} />,
    })),
  ];

  // Excludes whichever party is already the deal's customer, and (in edit
  // mode) whichever parties are already linked as partners -- a company or
  // contact shouldn't be offered twice.
  const existingPartnerValues = new Set(
    existingPartners.map((p) => (p.kind === "company" ? `company:${p.companyId}` : `contact:${p.contactId}`)),
  );
  const partnerOptions: SearchSelectOption[] = otherPartyOptions.filter(
    (opt) => opt.value !== partyValue(otherParty) && !existingPartnerValues.has(opt.value),
  );

  const companyContacts = otherParty?.kind === "company" ? contacts.filter((c) => c.companyId === otherParty.id) : [];
  const primaryContactOptions: SearchSelectOption[] = companyContacts.map((c) => ({
    value: c.id,
    label: c.fullName,
    icon: <UserIcon size={14} />,
  }));

  const employeeOptions: SearchSelectOption[] = employees.map((e) => ({ value: e.id, label: e.fullName }));
  const departmentOptions: SearchSelectOption[] = departments.map((d) => ({ value: d.id, label: d.name }));
  const costing = computeCosting(values.projectValue, values.internalCosts, values.externalCosts);
  const dealSourceOptions = [
    { value: "", label: "Not set" },
    ...dealSources.map((ds) => ({ value: ds.id, label: ds.name })),
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
        <div className="-mx-5 -mt-5 mb-5 flex border-b border-[var(--color-border)] px-5">
          {tabDefs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`mr-[22px] cursor-pointer border-0 border-b-2 bg-transparent px-1 py-3 text-[13.5px] font-semibold transition-colors duration-150 hover:text-[var(--color-text)] ${
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
          <div className="min-h-[420px]">
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

            {errors.currentStageId && (
              <p className="mb-[18px] mt-[-8px] text-[12.5px] text-[var(--color-danger)]">
                {errors.currentStageId}
              </p>
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
                Customer (Company or Contact) {!isEdit && "*"}
              </label>
              {isEdit ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[13.5px] text-[var(--color-text-muted)]">
                  {otherParty?.kind === "company" ? <BuildingIcon size={14} /> : <UserIcon size={14} />}
                  {deal?.companyName ?? deal?.contactName ?? "—"}
                </div>
              ) : (
                <>
                  <SearchSelect
                    value={partyValue(otherParty)}
                    onChange={handleOtherPartyChange}
                    options={otherPartyOptions}
                    placeholder="Search companies and contacts..."
                    searchPlaceholder="Search by name..."
                  />
                  {errors.otherParty && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{errors.otherParty}</p>
                  )}
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
          <div className="min-h-[420px]">
            <p className="text-[13.5px] text-[var(--color-text-muted)]">
              Tender details form — fields coming soon.
            </p>
          </div>
        )}

        {/* ── Delivery ──────────────────────────────────── */}
        {activeTab === "delivery" && (
          <div className="min-h-[420px]">
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
                  <SearchSelect
                    value=""
                    onChange={handleAddExistingPartner}
                    options={partnerOptions}
                    placeholder="Add a partner..."
                    searchPlaceholder="Search by name..."
                  />
                </>
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
          <div className="min-h-[420px]">
            <TextField
              label="Project Value without Tax (LKR)"
              name="projectValue"
              type="number"
              min="0"
              value={values.projectValue}
              placeholder="0"
              onChange={(e) => setField("projectValue", e.target.value)}
            />

            <TextField
              label="Internal Costs (LKR)"
              name="internalCosts"
              type="number"
              min="0"
              value={values.internalCosts}
              placeholder="0"
              onChange={(e) => setField("internalCosts", e.target.value)}
            />

            <TextField
              label="External Costs (LKR)"
              name="externalCosts"
              type="number"
              min="0"
              value={values.externalCosts}
              placeholder="0"
              onChange={(e) => setField("externalCosts", e.target.value)}
            />

            <div className="mb-[18px]">
              <label htmlFor="totalCost" className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Total Cost (LKR)
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
                Profit (LKR)
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
          <div className="min-h-[420px]">
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
          <div className="min-h-[420px]">
            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
                Sales Person *
              </label>
              <SearchSelect
                value={values.salesPersonId}
                onChange={(val) => setField("salesPersonId", val)}
                options={employeeOptions}
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
                options={employeeOptions}
                placeholder="Search employees..."
                searchPlaceholder="Search by name..."
              />
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">PMO</label>
              <SearchSelect
                value={values.pmoId}
                onChange={(val) => setField("pmoId", val)}
                options={employeeOptions}
                placeholder="Search employees..."
                searchPlaceholder="Search by name..."
              />
            </div>
          </div>
        )}

        {/* ── Documents ─────────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="min-h-[420px]">
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
          <div className="min-h-[420px]">
            {notes.length === 0 ? (
              <p className="text-[var(--color-text-muted)]">No notes yet. Add one below.</p>
            ) : (
              <div className="mb-5 flex flex-col gap-4">
                {notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-3">
                    <div
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-[12.5px] font-bold tracking-[0.02em] text-white"
                      aria-hidden="true"
                    >
                      {getInitials(note.author)}
                    </div>
                    <div className="min-w-0 flex-1 rounded-tl-[4px] rounded-tr-[14px] rounded-bl-[14px] rounded-br-[14px] border border-[var(--color-border)] bg-white px-[14px] py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--color-text)]">{note.author}</span>
                        <span className="flex-1 text-[11.5px] text-[var(--color-text-muted)]">
                          {formatNoteTime(note.createdAt)}
                        </span>
                        {note.author === CURRENT_USER_LABEL && editingNoteId !== note.id && (
                          <button
                            type="button"
                            className="flex flex-shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-[5px] text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#eaf1fd] hover:text-[var(--color-brand)]"
                            aria-label="Edit note"
                            onClick={() => startEditNote(note)}
                          >
                            <EditIcon size={14} />
                          </button>
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
                        <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-[var(--color-text)]">{note.text}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-3">
              <div
                className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-[12.5px] font-bold tracking-[0.02em] text-white"
                aria-hidden="true"
              >
                {getInitials(CURRENT_USER_LABEL)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <textarea
                  className={TEXTAREA_CLASS}
                  rows={3}
                  placeholder="Write a note..."
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
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
