"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { PlusIcon } from "@/components/ui/icons";
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
        mode === "create"
          ? `Add Person (${relationshipTypeName})`
          : mode === "view"
            ? "View Person"
            : "Edit Person"
      }
      onClose={onClose}
      maxWidth={showRelationshipsTab ? "680px" : "560px"}
    >
      <form onSubmit={handleSubmit}>
        {showRelationshipsTab && (
          <div className="dialog-tabs">
            <button
              type="button"
              className={`dialog-tab${activeTab === "details" ? " dialog-tab-active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              {t("relationshipTags.detailsTabLabel")}
            </button>
            <button
              type="button"
              className={`dialog-tab${activeTab === "relationships" ? " dialog-tab-active" : ""}`}
              onClick={() => setActiveTab("relationships")}
            >
              {t("relationshipTags.tabLabel")}
            </button>
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
              <div className="mb-[18px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Company</label>
                <CustomSelect
                  fullWidth
                  label=""
                  value={values.companyId}
                  onChange={(val) => setField("companyId", val)}
                  options={companyOptions}
                  disabled={isViewOnly}
                />
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  Select a company only if this contact works under an organization. Leave as &quot;None&quot; to list them as an individual standalone person.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Relationships ────────────────────────── */}
        {showRelationshipsTab && activeTab === "relationships" && (
          <div className="h-[480px] overflow-y-auto pr-1">
            {tagError && <p className="mb-2 text-[12.5px] text-[var(--color-danger)]">{tagError}</p>}
            {isLoadingTags ? (
              <Spinner size={20} />
            ) : (
              <RelationshipHubDiagram
                centerLabel={values.fullName}
                spokes={tagSpokes}
                emptyLabel={t("relationshipTags.emptyState")}
              />
            )}

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
