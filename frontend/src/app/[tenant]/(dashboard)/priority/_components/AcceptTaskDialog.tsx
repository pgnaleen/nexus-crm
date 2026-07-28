"use client";

import { useState } from "react";
import { PriorityTaskQuadrant, type PriorityTaskResponse } from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { acceptPriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { DEFAULT_QUADRANT, QUADRANTS } from "./types";

interface AcceptTaskDialogProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  onAccepted: (task: PriorityTaskResponse) => void;
}

// Story 2.9 -- accepting a delegation now picks its quadrant from four
// visual tiles rather than the drawer's inline dropdown. The quadrant is the
// one real decision in this flow (it's where the work lands on your board),
// and a collapsed <select> gave it the same weight as a filter control.
export function AcceptTaskDialog({ taskId, taskTitle, onClose, onAccepted }: AcceptTaskDialogProps) {
  const [selected, setSelected] = useState<PriorityTaskQuadrant>(DEFAULT_QUADRANT);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setIsSaving(true);
    setError(null);
    try {
      const task = await acceptPriorityTask(taskId, { quadrant: selected });
      onAccepted(task);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("priorityTracker.incoming.errors.acceptFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={t("priorityTracker.accept.title")} onClose={onClose} maxWidth="440px">
      <p className="mb-4 text-[13px] text-[var(--color-text-muted)]">{taskTitle}</p>

      {error && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{error}</p>}

      <p className="mb-2 text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
        {t("priorityTracker.accept.quadrantLabel")}
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUADRANTS.map((quadrant) => {
          const isSelected = quadrant.id === selected;
          return (
            <button
              key={quadrant.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(quadrant.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2.5 text-left transition-all duration-150 ${
                isSelected
                  ? "border-crm-primary bg-crm-primary-tint"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-text-muted)]"
              }`}
            >
              <span aria-hidden="true" className={`h-3 w-3 flex-shrink-0 rounded-full ${quadrant.dotClass}`} />
              <span className="min-w-0">
                <span className="block text-[13px] font-extrabold text-crm-text">{quadrant.watermark}</span>
                <span className="block text-[10.5px] font-semibold text-[var(--color-text-muted)]">
                  {t(`priorityTracker.quadrants.${quadrant.id}.sublabel`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="button" onClick={handleAccept} isLoading={isSaving}>
          {t("priorityTracker.accept.confirmButton")}
        </Button>
      </div>
    </Dialog>
  );
}
