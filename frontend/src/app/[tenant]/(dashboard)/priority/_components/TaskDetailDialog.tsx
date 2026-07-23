"use client";

import { useEffect, useState } from "react";
import type { PriorityTaskResponse } from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { getPriorityTask, updatePriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)]";

function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
        <div
          className="h-full rounded-full bg-crm-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[11.5px] font-semibold text-crm-text">{progress}%</p>
    </div>
  );
}

interface TaskDetailDialogProps {
  taskId: string;
  onClose: () => void;
  // The board's own card list doesn't show notes, but keeping its cached
  // copy in sync is good hygiene for whenever a future story does.
  onSaved: (task: PriorityTaskResponse) => void;
}

export function TaskDetailDialog({ taskId, onClose, onSaved }: TaskDetailDialogProps) {
  const [task, setTask] = useState<PriorityTaskResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTask(null);
    setLoadError(null);
    getPriorityTask(taskId)
      .then((fetched) => {
        if (cancelled) return;
        setTask(fetched);
        setNotes(fetched.notes ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Failed to load task");
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Only the current owner may edit notes -- a merely-shared (not owning)
  // recipient (Story 1.5, not built yet) gets read-only access. Every task
  // is "owned" by its viewer today, since there's no sharing/delegation to
  // produce a "received" task yet, but the gate is real, not a stub.
  const isOwner = task?.ownership === "owned";

  async function handleSaveNotes() {
    if (!task) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updatePriorityTask(task.id, { notes });
      setTask(updated);
      setNotes(updated.notes ?? "");
      setIsDirty(false);
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={task?.title ?? "…"} onClose={onClose} maxWidth="560px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!task && !loadError && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}

      {task && (
        <>
          <div className="mb-[18px] grid grid-cols-3 gap-3">
            <div>
              <p className="mb-1 text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                {t("priorityTracker.detailDialog.quadrantLabel")}
              </p>
              <p className="text-sm font-medium text-crm-text">
                {t(`priorityTracker.quadrants.${task.quadrant}.label`)}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                {t("priorityTracker.detailDialog.statusLabel")}
              </p>
              <p className="text-sm font-medium text-crm-text">
                {t(`priorityTracker.detailDialog.status.${task.status}`)}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                {t("priorityTracker.detailDialog.progressLabel")}
              </p>
              <ProgressBar progress={task.progress} />
            </div>
          </div>

          <div className="mb-[18px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
              {t("priorityTracker.detailDialog.notesLabel")}
            </label>
            {isOwner ? (
              <>
                <textarea
                  className={TEXTAREA_CLASS}
                  rows={4}
                  value={notes}
                  placeholder={t("priorityTracker.detailDialog.notesPlaceholder")}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                />
                {saveError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{saveError}</p>}
                {isDirty && (
                  <div className="mt-2 flex justify-end">
                    <Button type="button" onClick={handleSaveNotes} isLoading={isSaving}>
                      {t("priorityTracker.detailDialog.saveNotesButton")}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm whitespace-pre-wrap text-crm-text">
                  {task.notes || "—"}
                </p>
                <p className="mt-1.5 text-[12.5px] text-[var(--color-text-muted)]">
                  {t("priorityTracker.detailDialog.notesReadOnlyHint")}
                </p>
              </>
            )}
          </div>

          <div className="mb-2">
            <p className="mb-2 text-[13px] font-semibold text-[var(--color-text-muted)]">
              {t("priorityTracker.detailDialog.historyLabel")}
            </p>
            {/* Story 1.9 owns the real event-by-event lifecycle trail
                (Shared, Delegated, Progress updated, etc.) recorded via
                AuditLogService -- this is a minimal stand-in showing just
                the one event every task already has for real: its own
                creation, with who and when. */}
            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-crm-primary" />
              <span className="flex-1 text-[13px] text-crm-text">
                {task.createdByName
                  ? t("priorityTracker.detailDialog.historyCreatedByEntry", { actor: task.createdByName })
                  : t("priorityTracker.detailDialog.historyCreatedEntry")}
              </span>
              <span className="text-[11.5px] text-[var(--color-text-muted)]">{formatTimestamp(task.createdAt)}</span>
            </div>
          </div>
        </>
      )}

      <div className="mt-2 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.actions.close")}
        </Button>
      </div>
    </Dialog>
  );
}
