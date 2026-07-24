"use client";

import { useState } from "react";
import { EmployeeCertificationStatus } from "@orelia/common";
import type { CertificationResponse } from "@orelia/common";
import { deleteMyCertification } from "@/lib/api/certifications";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { EditIcon, ExternalLinkIcon, FileIcon, TrashIcon } from "@/components/ui/icons";
import { useAlert, useConfirm } from "@/components/providers/DialogProvider";
import { t } from "@/lib/i18n";
import { CertificationFormDialog } from "./CertificationFormDialog";

const STATUS_STYLES: Record<EmployeeCertificationStatus, { background: string; color: string }> = {
  [EmployeeCertificationStatus.Pending]: { background: "#fff4e5", color: "#b26a00" },
  [EmployeeCertificationStatus.Verified]: { background: "#e6f7ee", color: "#1a9c5f" },
  [EmployeeCertificationStatus.Rejected]: { background: "#fdecec", color: "#c0392b" },
};

export function MyCertifications({ initial }: { initial: CertificationResponse[] }) {
  const confirm = useConfirm();
  const { showError } = useAlert();
  const [certifications, setCertifications] = useState(initial);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<CertificationResponse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreated(certification: CertificationResponse) {
    setCertifications((current) => [certification, ...current]);
  }

  function handleUpdated(certification: CertificationResponse) {
    setCertifications((current) => current.map((item) => (item.id === certification.id ? certification : item)));
  }

  async function handleDelete(certification: CertificationResponse) {
    const ok = await confirm({
      title: t("profile.certifications.deleteConfirm.title"),
      message: t("profile.certifications.deleteConfirm.message", { name: certification.name }),
      confirmLabel: t("profile.certifications.deleteConfirm.confirmLabel"),
      isDestructive: true,
    });
    if (!ok) return;
    setDeletingId(certification.id);
    try {
      await deleteMyCertification(certification.id);
      setCertifications((current) => current.filter((item) => item.id !== certification.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("profile.certifications.errors.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="m-0 text-[12.5px] text-[var(--color-text-muted)]">{t("profile.certifications.hint")}</p>
        <Button type="button" onClick={() => setIsAddOpen(true)}>
          {t("profile.certifications.addButton")}
        </Button>
      </div>

      {certifications.length === 0 ? (
        <p className="m-0 text-[13px] text-[var(--color-text-muted)]">{t("profile.certifications.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {certifications.map((certification) => {
            const isPending = certification.status === EmployeeCertificationStatus.Pending;
            const isVerified = certification.status === EmployeeCertificationStatus.Verified;
            const statusStyle = STATUS_STYLES[certification.status];
            return (
              <div
                key={certification.id}
                className="rounded-xl border border-[var(--color-border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-crm-text">{certification.name}</span>
                      <span
                        className="inline-block rounded-full px-2.5 py-[2px] text-[11px] font-semibold"
                        style={{ background: statusStyle.background, color: statusStyle.color }}
                      >
                        {t(`profile.certifications.status.${certification.status}`)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                      {certification.issuingOrganization}
                      {certification.credentialId && ` · ${certification.credentialId}`}
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      {t("profile.certifications.issued")}: {certification.issueDate}
                      {certification.expiryDate && ` · ${t("profile.certifications.expires")}: ${certification.expiryDate}`}
                    </div>
                    {(certification.evidenceFileUrl || certification.evidenceLink) && (
                      <div className="mt-1.5 flex items-center gap-3">
                        {certification.evidenceFileUrl && (
                          <a
                            href={resolveUploadUrl(certification.evidenceFileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12.5px] text-crm-primary underline"
                          >
                            <FileIcon size={13} /> {t("profile.certifications.viewCertificate")}
                          </a>
                        )}
                        {certification.evidenceLink && (
                          <a
                            href={certification.evidenceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12.5px] text-crm-primary underline"
                          >
                            <ExternalLinkIcon size={13} /> {t("profile.certifications.verificationLink")}
                          </a>
                        )}
                      </div>
                    )}
                    {certification.status === EmployeeCertificationStatus.Rejected && certification.rejectionReason && (
                      <div className="mt-2 rounded-lg bg-[#fdecec] px-3 py-2 text-[12px] text-[#c0392b]">
                        <span className="font-semibold">{t("profile.certifications.rejectedReason")}:</span>{" "}
                        {certification.rejectionReason}
                      </div>
                    )}
                  </div>
                  {/* Pending: edit + delete. Rejected: delete only (housekeeping).
                      Verified: locked -- no actions. */}
                  {!isVerified && (
                    <div className="flex shrink-0 gap-1.5">
                      {isPending && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t("profile.certifications.editAriaLabel", { name: certification.name })}
                          onClick={() => setEditing(certification)}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        aria-label={t("profile.certifications.deleteAriaLabel", { name: certification.name })}
                        onClick={() => handleDelete(certification)}
                        disabled={deletingId === certification.id}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAddOpen && (
        <CertificationFormDialog onClose={() => setIsAddOpen(false)} onSaved={handleCreated} />
      )}
      {editing && (
        <CertificationFormDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleUpdated}
        />
      )}
    </div>
  );
}
