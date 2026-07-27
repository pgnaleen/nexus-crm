"use client";

import { useEffect, useState } from "react";
import type { PriorityTaskResponse } from "@orelia/common";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { listArchivedPriorityTasks, restorePriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { useAlert } from "@/components/providers/DialogProvider";
import { t } from "@/lib/i18n";

interface ArchivePanelDialogProps {
  onClose: () => void;
  // A restored task returns to the active board in its old quadrant.
  onRestored: (task: PriorityTaskResponse) => void;
}

export function ArchivePanelDialog({ onClose, onRestored }: ArchivePanelDialogProps) {
  const { showError } = useAlert();
  const [items, setItems] = useState<PriorityTaskResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listArchivedPriorityTasks()
      .then((fetched) => {
        if (!cancelled) setItems(fetched);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.archive.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRestore(task: PriorityTaskResponse) {
    setBusyId(task.id);
    try {
      const restored = await restorePriorityTask(task.id);
      onRestored(restored);
      setItems((current) => (current ?? []).filter((item) => item.id !== task.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("priorityTracker.archive.errors.restoreFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SidePanel title={t("priorityTracker.archive.title")} onClose={onClose} width="440px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!items && !loadError && (
        <p className="text-sm text-[var(--color-text-muted)]">{t("priorityTracker.archive.loading")}</p>
      )}

      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-[13px] font-medium text-crm-text">{t("priorityTracker.archive.emptyTitle")}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("priorityTracker.archive.emptyMessage")}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {items.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-crm-text">{task.title}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  {t("priorityTracker.archive.finalProgress", { value: String(task.progress) })}
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => handleRestore(task)} isLoading={busyId === task.id}>
                {t("priorityTracker.archive.restoreButton")}
              </Button>
            </div>
          ))}
        </div>
      )}

    </SidePanel>
  );
}
