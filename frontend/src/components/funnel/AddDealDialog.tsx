"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  DealPriority,
  DealType,
  DocumentType,
  type CompanyPickerResponse,
  type ContactPickerResponse,
  type DealResponse,
  type DealSourceResponse,
  type DepartmentResponse,
  type EmployeePickerResponse,
  type IndustryResponse,
  type RelationshipTypeResponse,
} from "@orelia/common";
import { type FunnelColumn } from "@/components/funnel/FunnelBoard";
import { addDealContact, createDeal, uploadDealDocument } from "@/lib/api/deals";
import { listCompaniesPicker, listContactsPicker } from "@/lib/api/pickers";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { BuildingIcon, FileIcon, TrashIcon, UploadCloudIcon, UserIcon } from "@/components/ui/icons";
import { required, validate } from "@/lib/validation";
import { CompanyFormDialog } from "@/app/[tenant]/(dashboard)/relationships/[id]/_components/CompanyFormDialog";
import { ContactFormDialog } from "@/app/[tenant]/(dashboard)/relationships/[id]/_components/ContactFormDialog";

const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  [DealPriority.Low]: "Low",
  [DealPriority.Medium]: "Medium",
  [DealPriority.High]: "High",
  [DealPriority.Critical]: "Critical",
};

const DEAL_PRIORITY_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(DealPriority).map((value) => ({ value, label: DEAL_PRIORITY_LABELS[value] })),
];

// dealType isn't shown in the form for now, but the backend contract still
// requires one on create -- default silently to the most common case until
// the field comes back.
const DEFAULT_DEAL_TYPE = DealType.NewBusiness;

interface StagedDocument {
  id: string;
  file: File;
}

interface DetailsFormState {
  name: string;
  sourceId: string;
  primaryContactId: string;
  ownerId: string;
  currentStageId: string;
  estimatedValue: string;
  expectedCloseDate: string;
  currency: string;
  probability: string;
  priority: DealPriority | "";
  departmentId: string;
  description: string;
}

type PartyKind = "company" | "contact";

interface OtherParty {
  kind: PartyKind;
  id: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

type TabId = "details" | "documents" | "contacts";

// Nested "create a new company/person" flow, reusing the exact same dialogs
// the Relationships section uses -- a new party still has to be tagged with
// a Relationship Type there, so we ask for that first.
type AddPartyState =
  | { step: "type" }
  | { step: "kind"; relationshipTypeId: string; relationshipTypeName: string }
  | { step: "company"; relationshipTypeId: string; relationshipTypeName: string }
  | { step: "contact"; relationshipTypeId: string; relationshipTypeName: string }
  | null;

// Linked Contacts only ever creates a person, so this skips the company/
// person "kind" step the Other Party flow needs.
type AddContactState =
  | { step: "type" }
  | { step: "form"; relationshipTypeId: string; relationshipTypeName: string }
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
      <p style={{ marginBottom: "16px", color: "var(--color-text-muted)" }}>
        Which relationship type does this belong to?
      </p>
      {relationshipTypes.length === 0 ? (
        <p className="field-error">No relationship types configured yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {relationshipTypes.map((rt) => (
            <button
              key={rt.id}
              type="button"
              className="funnel-add-btn"
              style={{ justifyContent: "center" }}
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
  departments: DepartmentResponse[];
  relationshipTypes: RelationshipTypeResponse[];
  industries: IndustryResponse[];
  defaultDealSourceId?: string;
  onClose: () => void;
  onCreated: (deal: DealResponse) => void;
}

export function AddDealDialog({
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
}: AddDealDialogProps) {
  const stages = stageOptions ?? columns;
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [companies, setCompanies] = useState(initialCompanies);
  const [contacts, setContacts] = useState(initialContacts);
  const [values, setValues] = useState<DetailsFormState>({
    name: "",
    sourceId: dealSources.some((s) => s.id === defaultDealSourceId) ? (defaultDealSourceId ?? "") : "",
    primaryContactId: "",
    ownerId: "",
    currentStageId: stages[0]?.id ?? "",
    estimatedValue: "",
    expectedCloseDate: "",
    currency: "",
    probability: "",
    priority: "",
    departmentId: "",
    description: "",
  });
  const [otherParty, setOtherParty] = useState<OtherParty | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsFormState | "otherParty", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [isDropActive, setIsDropActive] = useState(false);
  const [addPartyState, setAddPartyState] = useState<AddPartyState>(null);
  const [addContactState, setAddContactState] = useState<AddContactState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function runValidation(): boolean {
    const nextErrors: Partial<Record<keyof DetailsFormState | "otherParty", string>> = {};

    const nameError = validate(values.name, [required("Deal name is required")]);
    if (nameError) nextErrors.name = nameError;
    if (!otherParty) nextErrors.otherParty = "Select the other party for this deal";
    if (!values.ownerId) nextErrors.ownerId = "Owner is required";
    if (stages.length > 0 && !values.currentStageId) nextErrors.currentStageId = "Sub stage is required";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next = Array.from(fileList).map((file) => ({ id: crypto.randomUUID(), file }));
    setDocuments((prev) => [...prev, ...next]);
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
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
      setActiveTab("details");
      return;
    }

    // Deals still require a companyId on the backend. When the other party
    // is a person with no company of their own, there's nothing to send yet.
    let companyId: string | undefined;
    let contactId: string | undefined;
    let primaryContactId: string | undefined;
    if (otherParty?.kind === "company") {
      companyId = otherParty.id;
      primaryContactId = values.primaryContactId || undefined;
    } else if (otherParty?.kind === "contact") {
      const contact = contacts.find((c) => c.id === otherParty.id);
      companyId = contact?.companyId ?? undefined;
      contactId = otherParty.id;
      primaryContactId = otherParty.id;
    }

    if (!companyId) {
      setFormError(
        "The selected contact isn't linked to a company, and deals currently require one. Pick a contact that belongs to a company, or a company directly.",
      );
      setActiveTab("details");
      return;
    }

    setIsSaving(true);
    try {
      const deal = await createDeal({
        name: values.name.trim(),
        dealType: DEFAULT_DEAL_TYPE,
        description: values.description.trim() || undefined,
        companyId,
        contactId,
        primaryContactId,
        sourceId: values.sourceId || undefined,
        ownerId: values.ownerId,
        mainStageId: stages.find((s) => s.id === values.currentStageId)?.mainStageId,
        currentStageId: values.currentStageId,
        estimatedValue: values.estimatedValue.trim() ? Number(values.estimatedValue) : undefined,
        currency: values.currency.trim() || undefined,
        expectedCloseDate: values.expectedCloseDate || undefined,
        probability: values.probability.trim() ? Number(values.probability) : undefined,
        priority: values.priority || undefined,
        departmentId: values.departmentId || undefined,
      });

      await Promise.all([
        ...documents.map((doc) =>
          uploadDealDocument(deal.id, doc.file, { docType: DocumentType.Other, title: doc.file.name }),
        ),
        ...contactIds.map((linkedContactId) => addDealContact(deal.id, { contactId: linkedContactId })),
      ]);

      onCreated(deal);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create deal");
    } finally {
      setIsSaving(false);
    }
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

  const companyContacts = otherParty?.kind === "company" ? contacts.filter((c) => c.companyId === otherParty.id) : [];
  const primaryContactOptions: SearchSelectOption[] = companyContacts.map((c) => ({
    value: c.id,
    label: c.fullName,
    icon: <UserIcon size={14} />,
  }));

  const employeeOptions: SearchSelectOption[] = employees.map((e) => ({ value: e.id, label: e.fullName }));
  const dealSourceOptions = [
    { value: "", label: "Not set" },
    ...dealSources.map((ds) => ({ value: ds.id, label: ds.name })),
  ];
  const subStageOptions = stages.map((c) => ({ value: c.id, label: c.name }));
  const departmentOptions = [
    { value: "", label: "Not set" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  function openAddParty() {
    setAddPartyState(relationshipTypes.length === 1 ? { step: "kind", relationshipTypeId: relationshipTypes[0].id, relationshipTypeName: relationshipTypes[0].name } : { step: "type" });
  }

  function handlePartySaved() {
    void refreshPickers();
    setAddPartyState(null);
  }

  function openAddLinkedContact() {
    setAddContactState(
      relationshipTypes.length === 1
        ? { step: "form", relationshipTypeId: relationshipTypes[0].id, relationshipTypeName: relationshipTypes[0].name }
        : { step: "type" },
    );
  }

  function handleLinkedContactSaved() {
    void refreshPickers();
    setAddContactState(null);
  }

  return (
    <Dialog open title="Add New Deal" onClose={onClose} maxWidth="720px">
      <form onSubmit={handleSubmit}>
        <div className="dialog-tabs">
          <button
            type="button"
            className={`dialog-tab${activeTab === "details" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Deal Details
          </button>
          <button
            type="button"
            className={`dialog-tab${activeTab === "documents" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            Documents{documents.length > 0 ? ` (${documents.length})` : ""}
          </button>
          <button
            type="button"
            className={`dialog-tab${activeTab === "contacts" ? " dialog-tab-active" : ""}`}
            onClick={() => setActiveTab("contacts")}
          >
            Contacts{contactIds.length > 0 ? ` (${contactIds.length})` : ""}
          </button>
        </div>

        {formError && <p className="field-error">{formError}</p>}

        {/* ── Deal Details ─────────────────────────────── */}
        {activeTab === "details" && (
          <div>
            <TextField
              label="Deal Name *"
              name="name"
              value={values.name}
              error={errors.name}
              placeholder="e.g. TechNova Inc. — Platform Rollout"
              onChange={(e) => setField("name", e.target.value)}
            />

            <div className="field">
              <label>Deal Source</label>
              <CustomSelect
                fullWidth
                label=""
                value={values.sourceId}
                onChange={(val) => setField("sourceId", val)}
                options={dealSourceOptions}
              />
            </div>

            <div className="field">
              <label>Other Party (Company or Contact) *</label>
              <SearchSelect
                value={partyValue(otherParty)}
                onChange={handleOtherPartyChange}
                options={otherPartyOptions}
                placeholder="Search companies and contacts..."
                searchPlaceholder="Search by name..."
                addNewLabel="Add New"
                onAddNew={openAddParty}
              />
              {errors.otherParty && <p className="field-error">{errors.otherParty}</p>}
            </div>

            {otherParty?.kind === "company" && (
              <div className="field">
                <label>Primary Contact</label>
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

            <div className="field">
              <label>Owner (Employee) *</label>
              <SearchSelect
                value={values.ownerId}
                onChange={(val) => setField("ownerId", val)}
                options={employeeOptions}
                placeholder="Search employees..."
                searchPlaceholder="Search by name..."
              />
              {errors.ownerId && <p className="field-error">{errors.ownerId}</p>}
            </div>

            <div className="field">
              <label>Status</label>
              <span className="status-badge" style={{ background: "#e6f7ee", color: "#1a9c5f" }}>
                Open
              </span>
            </div>

            <div className="field-row">
              <TextField
                label="Currency"
                name="currency"
                value={values.currency}
                placeholder="e.g. USD"
                onChange={(e) => setField("currency", e.target.value.toUpperCase())}
                maxLength={3}
              />
              <TextField
                label="Probability (%)"
                name="probability"
                type="number"
                min="0"
                max="100"
                value={values.probability}
                placeholder="0-100"
                onChange={(e) => setField("probability", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Priority</label>
              <CustomSelect
                fullWidth
                label=""
                value={values.priority}
                onChange={(val) => setField("priority", val as DealPriority | "")}
                options={DEAL_PRIORITY_OPTIONS}
              />
            </div>

            <div className="field-row">
              <TextField
                label="Value ($)"
                name="estimatedValue"
                type="number"
                min="0"
                value={values.estimatedValue}
                placeholder="0"
                onChange={(e) => setField("estimatedValue", e.target.value)}
              />
              <TextField
                label="Expected Close Date"
                name="expectedCloseDate"
                type="date"
                value={values.expectedCloseDate}
                onChange={(e) => setField("expectedCloseDate", e.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Sub Stage {stages.length > 0 ? "*" : ""}</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.currentStageId}
                  onChange={(val) => setField("currentStageId", val)}
                  options={subStageOptions}
                />
                {errors.currentStageId && <p className="field-error">{errors.currentStageId}</p>}
              </div>
              <div className="field">
                <label>Department</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.departmentId}
                  onChange={(val) => setField("departmentId", val)}
                  options={departmentOptions}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                className="field-textarea"
                rows={3}
                value={values.description}
                placeholder="Any additional context about this deal..."
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Documents ─────────────────────────────────── */}
        {activeTab === "documents" && (
          <div>
            <div
              className={`deal-dropzone${isDropActive ? " deal-dropzone-active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDropActive(true);
              }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={handleDrop}
            >
              <UploadCloudIcon size={26} />
              <span>Click to upload or drag and drop</span>
              <span className="deal-dropzone-hint">Uploaded once you create the deal below</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {documents.length > 0 && (
              <div className="deal-doc-list">
                {documents.map((doc) => (
                  <div key={doc.id} className="deal-doc-item">
                    <span className="deal-doc-icon"><FileIcon size={18} /></span>
                    <div className="deal-doc-info">
                      <div className="deal-doc-name">{doc.file.name}</div>
                      <div className="deal-doc-size">{formatBytes(doc.file.size)}</div>
                    </div>
                    <button
                      type="button"
                      className="deal-doc-remove"
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

        {/* ── Contacts ──────────────────────────────────── */}
        {activeTab === "contacts" && (
          <div>
            <div className="field">
              <label>Linked Contacts</label>
              <MultiSelect
                values={contactIds}
                onChange={setContactIds}
                options={contacts.map((c) => ({ value: c.id, label: c.fullName }))}
                placeholder="Select contacts..."
                searchPlaceholder="Search contacts..."
                addNewLabel="Add New Contact"
                onAddNew={openAddLinkedContact}
              />
            </div>
          </div>
        )}

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Create Deal
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
          <p style={{ marginBottom: "16px", color: "var(--color-text-muted)" }}>
            Is this a company or an individual person?
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              className="funnel-add-btn"
              style={{ flex: 1, justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
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
              className="funnel-add-btn"
              style={{ flex: 1, justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
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

      {/* ── Add New Contact flow (Linked Contacts tab) ──── */}
      {addContactState?.step === "type" && (
        <ChooseRelationshipTypeDialog
          title="Add New Contact"
          relationshipTypes={relationshipTypes}
          onClose={() => setAddContactState(null)}
          onSelect={(rt) => setAddContactState({ step: "form", relationshipTypeId: rt.id, relationshipTypeName: rt.name })}
        />
      )}

      {addContactState?.step === "form" && (
        <ContactFormDialog
          mode="create"
          relationshipTypeId={addContactState.relationshipTypeId}
          relationshipTypeName={addContactState.relationshipTypeName}
          companies={companies}
          onClose={() => setAddContactState(null)}
          onSaved={handleLinkedContactSaved}
        />
      )}
    </Dialog>
  );
}
