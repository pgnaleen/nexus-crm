"use client";

import { useEffect, useState, type FormEvent, Fragment } from "react";
import type {
  CompanyPickerResponse,
  ContactResponse,
  RelationshipTagResponse,
  RelationshipTypePickerResponse,
} from "@orelia/common";
import {
  addContactTag,
  createRelationshipPartyContact,
  listContactTags,
  updateCompanyContact,
  updateRelationshipPartyContact,
} from "@/lib/api/relationship-parties";
import { listRelationshipTypesPicker } from "@/lib/api/pickers";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { RelationshipHubDiagram } from "@/components/ui/RelationshipHubDiagram";
import { Spinner } from "@/components/ui/Spinner";
import { PlusIcon, UserIcon } from "@/components/ui/icons";
import { email as emailValidator, linkedInUrl, minLength, phoneNumber, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";
import { ContactFields, type ContactFieldsValue } from "./ContactFields";

interface FormState extends ContactFieldsValue {
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

type TabId = "details" | "relationships";

interface ContactFormDialogProps {
  mode: "create" | "edit" | "view";
  relationshipTypeId: string;
  relationshipTypeName: string;
  mapId?: string;
  // Set when editing a company-owned contact instead of a standalone
  // relationship party -- these have no party mapId of their own (see
  // CLAUDE.md/the 2026-07-22 double-counting fix), so they're reached via
  // the company's own mapId + the contact's own id instead.
  companyContext?: { companyMapId: string; contactId: string };
  contact?: ContactResponse;
  companies: CompanyPickerResponse[];
  // Gates the "add a relationship type tag" picker on the Relationships tab
  // (RELATIONSHIP_CREATE) -- mirrors CompanyFormDialog's own canCreate prop.
  canCreate?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ContactFormDialog({
  mode,
  relationshipTypeId,
  relationshipTypeName,
  mapId,
  companyContext,
  contact,
  companies,
  canCreate = false,
  onClose,
  onSaved,
}: ContactFormDialogProps) {
  const isViewOnly = mode === "view";
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [values, setValues] = useState<FormState>(() => toFormState(contact));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Relationships tab -- cross-relationship-type tags for this standalone
  // Contact (see relationship-tags.controller.ts). Keyed by contact.id (the
  // real Contact id), not mapId (this relationship type's own party row
  // id). Deliberately not offered at all for a company-owned contact --
  // those never get their own independent tag row (see
  // linkExistingContactToType's guard in relationship-parties.service.ts,
  // the same 2026-07-22 double-counting fix); their tags live on the
  // company instead, so the tab is hidden rather than always showing an
  // empty diagram. Checks contact.companyId directly (not just the
  // companyContext prop) as defense in depth -- found in review: the two
  // current call sites always pass companyContext for a company-owned
  // contact, but nothing previously enforced that invariant if a future
  // caller opened this dialog without it.
  const showRelationshipsTab = mode !== "create" && !companyContext && !!contact && !contact.companyId;

  const [tags, setTags] = useState<RelationshipTagResponse[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(showRelationshipsTab);
  const [relationshipTypeOptions, setRelationshipTypeOptions] = useState<RelationshipTypePickerResponse[]>([]);
  const [selectedTagTypeId, setSelectedTagTypeId] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (!showRelationshipsTab || !contact) return;
    let cancelled = false;
    setIsLoadingTags(true);
    listContactTags(contact.id)
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
  }, [showRelationshipsTab, contact]);

  // Uses the dedicated /pickers/relationship-types route -- see
  // CompanyFormDialog's identical effect for why (found in review: the full
  // admin GET /relationship-types is gated on RELATIONSHIP_TYPE_*, not the
  // RELATIONSHIP_* permission this dialog's canCreate actually checks).
  useEffect(() => {
    if (mode !== "edit" || !canCreate || !showRelationshipsTab) return;
    let cancelled = false;
    listRelationshipTypesPicker()
      .then((rows) => {
        if (!cancelled) setRelationshipTypeOptions(rows);
      })
      .catch(() => {
        // Surfaced (not swallowed) -- found in review.
        if (!cancelled) setTagError(t("relationshipTags.errors.loadTypesFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, canCreate, showRelationshipsTab]);

  async function refreshTags() {
    if (!contact) return;
    try {
      const rows = await listContactTags(contact.id);
      setTags(rows);
    } catch {
      // Non-fatal -- the just-added tag already succeeded; the list will
      // catch up next time this dialog opens.
    }
  }

  async function handleAddTag() {
    if (!contact || !selectedTagTypeId) return;
    setTagError(null);
    setIsAddingTag(true);
    try {
      await addContactTag(contact.id, { relationshipTypeId: selectedTagTypeId });
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
    if (values.mobileNo) {
      const mobileError = validate(values.mobileNo, [phoneNumber()]);
      if (mobileError) nextErrors.mobileNo = mobileError;
    }
    if (values.directPhoneNo) {
      const directPhoneError = validate(values.directPhoneNo, [phoneNumber()]);
      if (directPhoneError) nextErrors.directPhoneNo = directPhoneError;
    }
    if (values.linkedIn) {
      const linkedInError = validate(values.linkedIn, [linkedInUrl()]);
      if (linkedInError) nextErrors.linkedIn = linkedInError;
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
        const payload = {
          fullName: values.fullName.trim(),
          title: values.title.trim() || undefined,
          department: values.department.trim() || undefined,
          roleBuying: values.roleBuying || null,
          email: values.email.trim() || undefined,
          mobileNo: values.mobileNo.trim() || undefined,
          directPhoneNo: values.directPhoneNo.trim() || undefined,
          linkedIn: values.linkedIn.trim() || undefined,
          country: values.country.trim() || undefined,
          timezone: values.timezone.trim() || undefined,
          companyId: values.companyId || undefined,
        };
        if (companyContext) {
          await updateCompanyContact(relationshipTypeId, companyContext.companyMapId, companyContext.contactId, payload);
        } else {
          await updateRelationshipPartyContact(relationshipTypeId, mapId!, payload);
        }
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

  const tagSpokes = tags.map((tag) => ({ id: tag.mapId, label: tag.relationshipTypeName, isActive: tag.isActive }));
  // Only ACTIVE tags block re-selection -- see CompanyFormDialog's identical
  // fix (found in review: a disabled tag's type was permanently unselectable
  // here, making the backend's reactivate-via-setActive path unreachable).
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
            <UserIcon size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-crm-text">
              {mode === "create"
                ? `Add Person (${relationshipTypeName})`
                : mode === "view"
                  ? "View Person"
                  : "Edit Person"}
            </span>
            {mode !== "create" && contact && (
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
                {contact.fullName}
              </span>
            )}
          </div>
        </div>
      }
      onClose={onClose}
      maxWidth={showRelationshipsTab ? "680px" : "560px"}
    >
      <form onSubmit={handleSubmit}>
        {showRelationshipsTab && (
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl mb-6 select-none border border-slate-200/40 shadow-sm">
            {(() => {
              const tabsOrder = ["details", "relationships"];
              return tabsOrder.map((tabId, idx) => {
                const isActive = activeTab === tabId;
                const showDivider = idx > 0 && !isActive && activeTab !== tabsOrder[idx - 1];
                
                let label = "";
                let icon = null;
                if (tabId === "details") {
                  label = t("relationshipTags.detailsTabLabel");
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
        )}
 
        {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}
 
        {/* ── Tab 1: Details ──────────────────────────────── */}
        {(!showRelationshipsTab || activeTab === "details") && (
          <div className="h-[480px] overflow-y-auto pr-1">
            <ContactFields
              values={values}
              errors={errors}
              fullNameRequired
              disabled={isViewOnly}
              onChange={(field, value) => setField(field, value as never)}
            />
 
            {!companyContext && (
              <div className="mt-4 bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
                <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Organization Assignment</span>
                </div>
                <div className="mb-2">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Company</label>
                  <CustomSelect
                    fullWidth
                    label=""
                    value={values.companyId}
                    onChange={(val) => setField("companyId", val)}
                    options={companyOptions}
                    disabled={isViewOnly}
                  />
                  <p className="mt-2 text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                    Select a company only if this contact works under an organization. Leave as &quot;None&quot; to list them as an individual standalone person.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
 
        {/* ── Tab 2: Relationships ────────────────────────── */}
        {showRelationshipsTab && activeTab === "relationships" && (
          <div className="h-[480px] overflow-y-auto pr-1">
            {tagError && <p className="mb-2 text-[12.5px] text-[var(--color-danger)]">{tagError}</p>}
            
            <div className="bg-slate-50/30 border border-slate-200/80 rounded-xl p-6 mb-4 flex flex-col items-center justify-center">
              {isLoadingTags ? (
                <div className="h-40 flex items-center justify-center">
                  <Spinner size={20} />
                </div>
              ) : (
                <RelationshipHubDiagram
                  centerLabel={values.fullName}
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
 
        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" isLoading={isSaving}>
              {mode === "create" ? "Create person" : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
