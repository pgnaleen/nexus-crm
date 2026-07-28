"use client";

import { useEffect, useState } from "react";
import type { PriorityTaskResponse } from "@orelia/common";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { deletePriorityTask, listArchivedPriorityTasks, restorePriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { useAlert, useConfirm } from "@/components/providers/DialogProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { t } from "@/lib/i18n";

interface ArchivePanelDialogProps {
  onClose: () => void;
  // A restored task returns to the active board in its old quadrant.
  onRestored: (task: PriorityTaskResponse) => void;
}

export function ArchivePanelDialog({ onClose, onRestored }: ArchivePanelDialogProps) {
  const { showError } = useAlert();
  const confirm = useConfirm();
  // Delete toasts from here (this panel owns it end to end); restore is
  // handed to the board via onRestored, which toasts it.
  const { showToast } = useToast();
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

  // Story 2.10 -- soft delete behind a confirmation. No password re-entry:
  // CLAUDE.md requires that for *cascading* deletes, and nothing cascades off
  // a personal task -- its share/tracker rows are pure references, and other
  // people's own copies are untouched.
  async function handleDelete(task: PriorityTaskResponse) {
    const confirmed = await confirm({
      title: t("priorityTracker.archive.deleteConfirm.title"),
      message: t("priorityTracker.archive.deleteConfirm.message", { title: task.title }),
      confirmLabel: t("priorityTracker.archive.deleteButton"),
      isDestructive: true,
    });
    if (!confirmed) return;

    setBusyId(task.id);
    try {
      await deletePriorityTask(task.id);
      setItems((current) => (current ?? []).filter((item) => item.id !== task.id));
      showToast({ message: t("priorityTracker.toast.deleted") });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("priorityTracker.archive.errors.deleteFailed"));
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
              {/* Story 2.10 -- final progress as a green check pill, matching
                  the board card's own "Done" pill so the two read as the same
                  fact rather than two different greens. */}
              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-pd-pill-done-bg px-[7px] py-[2px] text-[10.5px] font-extrabold text-pd-pill-done-fg">
                <span aria-hidden="true">✓</span>
                {task.progress}%
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-crm-text">{task.title}</div>
                {/* Attribution. The prototype also appends " · via {current
                    owner}", which has no reachable case here: this list is
                    owner-scoped (findArchivedForUser filters ownerId = me), so
                    the current owner is always the viewer. "by {creator}"
                    already carries the only interesting signal -- that the
                    task reached me through someone else's delegation. */}
                <div className="mt-0.5 text-[11px] font-bold text-[var(--color-text-muted)]">
                  {t("priorityTracker.archive.byCreator", {
                    name: task.createdByName ?? t("priorityTracker.archive.unknownCreator"),
                  })}
                </div>
              </div>

              <Button type="button" variant="secondary" onClick={() => handleRestore(task)} isLoading={busyId === task.id}>
                {t("priorityTracker.archive.restoreButton")}
              </Button>
              <button
                type="button"
                disabled={busyId === task.id}
                onClick={() => handleDelete(task)}
                className="flex-shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13px] font-semibold text-[var(--color-danger)] transition-colors duration-150 hover:bg-crm-primary-tint disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("priorityTracker.archive.deleteButton")}
              </button>
            </div>
          ))}
        </div>
      )}

    </SidePanel>
  );
}
