"use client";

import { useEffect, useState } from "react";
import type { PriorityTaskResponse, PriorityTaskShareResponse, UserPickerResponse } from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TrashIcon } from "@/components/ui/icons";
import {
  getPriorityTask,
  listPriorityTaskShares,
  removePriorityTaskShare,
  updatePriorityTask,
} from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { DelegateTaskDialog } from "./DelegateTaskDialog";
import { ShareTaskDialog } from "./ShareTaskDialog";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-crm-primary)_15%,transparent)]";

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
  // Story 1.6 (Delegate) -- the board owns quadrant placement, so
  // delegating closes this dialog and hands off to PriorityBoard to move
  // the task into the delegator's own Delegate quadrant.
  onDelegated: (task: PriorityTaskResponse, delegateUser: UserPickerResponse) => void;
}

export function TaskDetailDialog({ taskId, onClose, onSaved, onDelegated }: TaskDetailDialogProps) {
  const [task, setTask] = useState<PriorityTaskResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sharedWith, setSharedWith] = useState<PriorityTaskShareResponse[]>([]);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDelegateDialogOpen, setIsDelegateDialogOpen] = useState(false);

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
        setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Only the current owner may edit notes or manage sharing -- a merely-
  // shared (not owning) recipient gets read-only access.
  const isOwner = task?.ownership === "owned";

  useEffect(() => {
    if (!isOwner || !task) return;
    let cancelled = false;
    listPriorityTaskShares(task.id)
      .then((shares) => {
        if (!cancelled) setSharedWith(shares);
      })
      .catch(() => {
        // Non-fatal -- the rest of the detail view still works without it.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, task?.id]);

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

  function handleShared(share: PriorityTaskShareResponse) {
    setSharedWith((current) => [...current, share]);
  }

  async function handleRemoveShare(shareId: string) {
    if (!task) return;
    const previous = sharedWith;
    setSharedWith((current) => current.filter((s) => s.id !== shareId));
    try {
      await removePriorityTaskShare(task.id, shareId);
    } catch (err) {
      setSharedWith(previous);
      setSaveError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.errors.unshareFailed"));
    }
  }

  function handleDelegated(user: UserPickerResponse) {
    if (!task) return;
    onDelegated(task, user);
    onClose();
  }

  return (
    <Dialog open title={task?.title ?? t("priorityTracker.detailDialog.loadingTitle")} onClose={onClose} maxWidth="560px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!task && !loadError && (
        <p className="text-sm text-[var(--color-text-muted)]">{t("priorityTracker.detailDialog.loading")}</p>
      )}

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

          {isOwner && (
            <div className="mb-[18px]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {t("priorityTracker.detailDialog.sharedLabel")}
                </p>
                <Button type="button" variant="secondary" onClick={() => setIsShareDialogOpen(true)}>
                  {t("priorityTracker.detailDialog.shareButton")}
                </Button>
              </div>
              {sharedWith.length === 0 ? (
                <p className="text-[12.5px] text-[var(--color-text-muted)]">
                  {t("priorityTracker.detailDialog.sharedEmpty")}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {sharedWith.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                    >
                      <span className="flex-1 text-[13.5px] text-crm-text">{share.displayName}</span>
                      <button
                        type="button"
                        aria-label={t("priorityTracker.detailDialog.removeShareAriaLabel", {
                          name: share.displayName,
                        })}
                        className="flex cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                        onClick={() => handleRemoveShare(share.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isOwner && (
            <div className="mb-[18px] flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5">
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                {t("priorityTracker.detailDialog.delegateHint")}
              </p>
              <Button type="button" variant="secondary" onClick={() => setIsDelegateDialogOpen(true)}>
                {t("priorityTracker.detailDialog.delegateButton")}
              </Button>
            </div>
          )}

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

      {isShareDialogOpen && task && (
        <ShareTaskDialog
          taskId={task.id}
          alreadySharedWithIds={sharedWith.map((s) => s.userId)}
          onClose={() => setIsShareDialogOpen(false)}
          onShared={handleShared}
        />
      )}

      {isDelegateDialogOpen && task && (
        <DelegateTaskDialog onClose={() => setIsDelegateDialogOpen(false)} onDelegated={handleDelegated} />
      )}
    </Dialog>
  );
}
