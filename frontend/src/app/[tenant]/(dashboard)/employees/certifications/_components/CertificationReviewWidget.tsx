"use client";

import { useState } from "react";
import type { CertificationReviewResponse } from "@orelia/common";
import { rejectCertification, verifyCertification } from "@/lib/api/certifications";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { ExternalLinkIcon, FileIcon } from "@/components/ui/icons";
import { useAlert } from "@/components/providers/DialogProvider";
import { t } from "@/lib/i18n";
import { RejectCertificationDialog } from "./RejectCertificationDialog";

interface CertificationReviewWidgetProps {
  initial: CertificationReviewResponse[];
}

// This is the "Pending Review" tab of the Certifications page -- access
// gating happens one level up, in page.tsx, by only including this tab when
// the caller holds EMPLOYEES_VERIFY_CERTIFICATIONS.
export function CertificationReviewWidget({ initial }: CertificationReviewWidgetProps) {
  const { showError, showSuccess } = useAlert();
  const [pending, setPending] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<CertificationReviewResponse | null>(null);

  async function handleVerify(certification: CertificationReviewResponse) {
    setBusyId(certification.id);
    try {
      await verifyCertification(certification.id);
      setPending((current) => current.filter((item) => item.id !== certification.id));
      showSuccess(t("certificationReview.verified", { name: certification.name }));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("certificationReview.errors.verifyFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectConfirmed(reason: string) {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await rejectCertification(rejecting.id, reason);
      setPending((current) => current.filter((item) => item.id !== rejecting.id));
      showSuccess(t("certificationReview.rejected", { name: rejecting.name }));
      setRejecting(null);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("certificationReview.errors.rejectFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {pending.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{t("certificationReview.emptyTitle")}</p>
          <p className="empty-state-message">{t("certificationReview.emptyMessage")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((certification) => {
            const hasEvidence = Boolean(certification.evidenceFileUrl || certification.evidenceLink);
            return (
              <div key={certification.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-crm-text">{certification.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                      {t("certificationReview.submittedBy")}:{" "}
                      <span className="font-medium text-crm-text">{certification.employeeName}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                      {certification.issuingOrganization}
                      {certification.credentialId && ` · ${certification.credentialId}`}
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      {t("certificationReview.issued")}: {certification.issueDate}
                      {certification.expiryDate &&
                        ` · ${t("certificationReview.expires")}: ${certification.expiryDate}`}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      {certification.evidenceFileDisplayUrl && (
                        <a
                          href={certification.evidenceFileDisplayUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12.5px] text-crm-primary underline"
                        >
                          <FileIcon size={13} /> {t("certificationReview.viewCertificate")}
                        </a>
                      )}
                      {certification.evidenceLink && (
                        <a
                          href={certification.evidenceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12.5px] text-crm-primary underline"
                        >
                          <ExternalLinkIcon size={13} /> {t("certificationReview.verificationLink")}
                        </a>
                      )}
                      {!hasEvidence && (
                        <span className="text-[12px] font-medium text-[#c0392b]">
                          {t("certificationReview.noEvidence")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {/* AC: a claim with no evidence can be rejected but not
                        verified -- the Verify button is disabled and the
                        reason shown above. The backend enforces this too. */}
                    <Button
                      type="button"
                      onClick={() => handleVerify(certification)}
                      isLoading={busyId === certification.id}
                      disabled={!hasEvidence || busyId === certification.id}
                    >
                      {t("certificationReview.verifyButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      style={{ color: "#c0392b", borderColor: "#c0392b" }}
                      onClick={() => setRejecting(certification)}
                      disabled={busyId === certification.id}
                    >
                      {t("certificationReview.rejectButton")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejecting && (
        <RejectCertificationDialog
          certificationName={rejecting.name}
          onClose={() => setRejecting(null)}
          onConfirm={handleRejectConfirmed}
        />
      )}
    </div>
  );
}
