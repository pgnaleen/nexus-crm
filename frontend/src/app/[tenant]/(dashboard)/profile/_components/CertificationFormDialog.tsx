"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CertificationResponse, CreateCertificationRequest, UpdateCertificationRequest } from "@orelia/common";
import { createMyCertification, updateMyCertification } from "@/lib/api/certifications";
import { uploadCertification } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { UploadCloudIcon } from "@/components/ui/icons";
import { minLength, required, validate } from "@/lib/validation";
import { t } from "@/lib/i18n";

interface FormState {
  name: string;
  issuingOrganization: string;
  credentialId: string;
  issueDate: string;
  expiryDate: string;
  evidenceFileUrl: string;
  evidenceLink: string;
}

function toFormState(certification?: CertificationResponse): FormState {
  return {
    name: certification?.name ?? "",
    issuingOrganization: certification?.issuingOrganization ?? "",
    credentialId: certification?.credentialId ?? "",
    issueDate: certification?.issueDate ?? "",
    expiryDate: certification?.expiryDate ?? "",
    evidenceFileUrl: certification?.evidenceFileUrl ?? "",
    evidenceLink: certification?.evidenceLink ?? "",
  };
}

interface CertificationFormDialogProps {
  initial?: CertificationResponse;
  onClose: () => void;
  onSaved: (certification: CertificationResponse) => void;
}

export function CertificationFormDialog({ initial, onClose, onSaved }: CertificationFormDialogProps) {
  const isEditMode = Boolean(initial);
  const [values, setValues] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError(null);
    setIsUploading(true);
    try {
      const { key } = await uploadCertification(file, values.name);
      setField("evidenceFileUrl", key);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("profile.certifications.errors.uploadFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function runValidation(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    const nameError = validate(values.name, [required(), minLength(1)]);
    if (nameError) next.name = nameError;
    const orgError = validate(values.issuingOrganization, [required(), minLength(1)]);
    if (orgError) next.issuingOrganization = orgError;
    if (!values.issueDate) next.issueDate = t("profile.certifications.errors.issueDateRequired");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!runValidation()) return;

    setIsSaving(true);
    try {
      let saved: CertificationResponse;
      if (isEditMode && initial) {
        // Tri-state: send every field; "" -> null clears optional ones.
        const payload: UpdateCertificationRequest = {
          name: values.name.trim(),
          issuingOrganization: values.issuingOrganization.trim(),
          credentialId: values.credentialId.trim() || null,
          issueDate: values.issueDate,
          expiryDate: values.expiryDate || null,
          evidenceFileUrl: values.evidenceFileUrl || null,
          evidenceLink: values.evidenceLink.trim() || null,
        };
        saved = await updateMyCertification(initial.id, payload);
      } else {
        const payload: CreateCertificationRequest = {
          name: values.name.trim(),
          issuingOrganization: values.issuingOrganization.trim(),
          credentialId: values.credentialId.trim() || undefined,
          issueDate: values.issueDate,
          expiryDate: values.expiryDate || undefined,
          evidenceFileUrl: values.evidenceFileUrl || undefined,
          evidenceLink: values.evidenceLink.trim() || undefined,
        };
        saved = await createMyCertification(payload);
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("profile.certifications.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const fileName = values.evidenceFileUrl ? values.evidenceFileUrl.split("/").pop() : null;

  return (
    <Dialog
      open
      title={isEditMode ? t("profile.certifications.editTitle") : t("profile.certifications.addTitle")}
      onClose={onClose}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit}>
        {formError && <p className="mb-3 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <TextField
          label={t("profile.certifications.form.name")}
          name="name"
          value={values.name}
          error={errors.name}
          placeholder={t("profile.certifications.form.namePlaceholder")}
          onChange={(e) => setField("name", e.target.value)}
        />
        <TextField
          label={t("profile.certifications.form.issuingOrganization")}
          name="issuingOrganization"
          value={values.issuingOrganization}
          error={errors.issuingOrganization}
          placeholder={t("profile.certifications.form.issuingOrganizationPlaceholder")}
          onChange={(e) => setField("issuingOrganization", e.target.value)}
        />
        <TextField
          label={t("profile.certifications.form.credentialId")}
          name="credentialId"
          value={values.credentialId}
          onChange={(e) => setField("credentialId", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3.5">
          <TextField
            label={t("profile.certifications.form.issueDate")}
            name="issueDate"
            type="date"
            value={values.issueDate}
            error={errors.issueDate}
            onChange={(e) => setField("issueDate", e.target.value)}
          />
          <TextField
            label={t("profile.certifications.form.expiryDate")}
            name="expiryDate"
            type="date"
            value={values.expiryDate}
            onChange={(e) => setField("expiryDate", e.target.value)}
          />
        </div>

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
            {t("profile.certifications.form.evidence")}
          </label>
          <p className="mb-2 text-[11.5px] text-[var(--color-text-muted)]">
            {t("profile.certifications.form.evidenceHint")}
          </p>
          <div className="flex items-center gap-3">
            {fileName && (
              <span className="max-w-[180px] truncate text-[12.5px] text-crm-text">{fileName}</span>
            )}
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={isUploading}>
              <UploadCloudIcon size={14} />{" "}
              {values.evidenceFileUrl
                ? t("profile.certifications.form.replaceFile")
                : t("profile.certifications.form.uploadFile")}
            </Button>
            {values.evidenceFileUrl && (
              <Button type="button" variant="secondary" onClick={() => setField("evidenceFileUrl", "")}>
                {t("profile.certifications.form.removeFile")}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              hidden
              onChange={handleFileChange}
            />
          </div>
        </div>

        <TextField
          label={t("profile.certifications.form.verificationLink")}
          name="evidenceLink"
          value={values.evidenceLink}
          placeholder={t("profile.certifications.form.verificationLinkPlaceholder")}
          onChange={(e) => setField("evidenceLink", e.target.value)}
        />

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEditMode ? t("profile.certifications.form.saveButton") : t("profile.certifications.form.createButton")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
