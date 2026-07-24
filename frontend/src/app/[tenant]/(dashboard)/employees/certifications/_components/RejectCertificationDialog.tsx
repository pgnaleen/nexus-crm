"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

interface RejectCertificationDialogProps {
  certificationName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectCertificationDialog({ certificationName, onClose, onConfirm }: RejectCertificationDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError(t("certificationReview.rejectDialog.reasonRequired"));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    // The parent owns the async call + closing; this just guards double-submit.
    onConfirm(reason.trim());
  }

  return (
    <Dialog open title={t("certificationReview.rejectDialog.title")} onClose={onClose} maxWidth="480px">
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-[13.5px] text-[var(--color-text-muted)]">
          {t("certificationReview.rejectDialog.message", { name: certificationName })}
        </p>
        <div className="mb-[18px]">
          <label
            htmlFor="rejectionReason"
            className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]"
          >
            {t("certificationReview.rejectDialog.reasonLabel")}
          </label>
          <textarea
            id="rejectionReason"
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 font-[inherit] text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)] focus:outline-none"
            rows={3}
            value={reason}
            placeholder={t("certificationReview.rejectDialog.reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
        </div>
        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            style={{ backgroundColor: "#c0392b", borderColor: "#c0392b" }}
          >
            {t("certificationReview.rejectDialog.confirmButton")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
