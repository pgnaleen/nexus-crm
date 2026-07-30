"use client";

import { useEffect, useState } from "react";
import type { IncomingTaskResponse, PriorityTaskResponse, UserPickerResponse } from "@orelia/common";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { listIncomingPriorityTasks, redelegatePriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { useAlert } from "@/components/providers/DialogProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { t } from "@/lib/i18n";
import { AcceptTaskDialog } from "./AcceptTaskDialog";
import { DelegateTaskDialog } from "./DelegateTaskDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";

const NOTES_PREVIEW_LENGTH = 80;

function notesPreview(notes: string | null): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  return trimmed.length > NOTES_PREVIEW_LENGTH ? `${trimmed.slice(0, NOTES_PREVIEW_LENGTH)}…` : trimmed;
}

interface IncomingPanelDialogProps {
  onClose: () => void;
  // Accepting a delegated task transfers ownership and drops it on the
  // board -- the board re-fetches so the new card (and the delegate-tracker
  // list) reflect it.
  onAccepted: (task: PriorityTaskResponse) => void;
  // Keeps the header's Incoming count in sync as items are actioned.
  onCountChange: (count: number) => void;
  // Threaded down to the "Open" (read-only) TaskDetailDialog's Discussion
  // tab -- own-vs-other bubble alignment.
  currentUserId: string;
}

export function IncomingPanelDialog({ onClose, onAccepted, onCountChange, currentUserId }: IncomingPanelDialogProps) {
  const { showError } = useAlert();
  const { showToast } = useToast();
  const [items, setItems] = useState<IncomingTaskResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [redelegatingId, setRedelegatingId] = useState<string | null>(null);
  // Story 2.9 -- "Add to board" now opens a quadrant-tile dialog rather than
  // reading an inline dropdown, and "Open" reads the task read-only.
  const [acceptingItem, setAcceptingItem] = useState<IncomingTaskResponse | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listIncomingPriorityTasks()
      .then((fetched) => {
        if (cancelled) return;
        setItems(fetched);
        onCountChange(fetched.length);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.incoming.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeItem(id: string) {
    setItems((current) => {
      const next = (current ?? []).filter((item) => item.id !== id);
      onCountChange(next.length);
      return next;
    });
  }

  function handleAccepted(task: PriorityTaskResponse) {
    onAccepted(task);
    if (acceptingItem) removeItem(acceptingItem.id);
  }

  async function handleRedelegated(user: UserPickerResponse) {
    if (!redelegatingId) return;
    const id = redelegatingId;
    setBusyId(id);
    try {
      await redelegatePriorityTask(id, { userId: user.id });
      removeItem(id);
      // Story 2.11 -- toasted here because re-delegation is fully owned by
      // this panel; accept is handed to the board via onAccepted, which
      // toasts that one.
      showToast({ message: t("priorityTracker.toast.redelegated", { name: user.displayName }) });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("priorityTracker.incoming.errors.redelegateFailed"));
    } finally {
      setBusyId(null);
      setRedelegatingId(null);
    }
  }

  const count = items?.length ?? 0;

  return (
    <SidePanel
      title={t("priorityTracker.incoming.title")}
      subtitle={
        count > 0
          ? t("priorityTracker.incoming.waitingCount", { count: String(count) })
          : t("priorityTracker.incoming.subtitle")
      }
      onClose={onClose}
      width="440px"
    >
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!items && !loadError && (
        <p className="text-sm text-[var(--color-text-muted)]">{t("priorityTracker.incoming.loading")}</p>
      )}

      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          <span aria-hidden="true" className="mb-2 text-[34px] opacity-55">
            🛰️
          </span>
          <p className="text-[13px] font-bold text-crm-text">{t("priorityTracker.incoming.emptyTitle")}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("priorityTracker.incoming.emptyMessage")}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isDelegated = item.kind === "delegated";
            const preview = notesPreview(item.notes);
            return (
              <div
                key={item.id}
                // Story 2.9 -- a 4px kind bar, amber for a delegation and blue
                // for a share, so the two are separable at a glance before
                // reading either badge or action set.
                className={`rounded-xl border border-l-4 border-[var(--color-border)] bg-white p-3.5 ${
                  isDelegated ? "border-l-pd-dg-acc" : "border-l-pd-de-acc"
                }`}
              >
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-crm-text">{item.title}</span>
                    <span
                      className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-[2px] text-[10.5px] font-semibold ${
                        isDelegated
                          ? "bg-pd-pill-track-bg text-pd-pill-track-fg"
                          : "bg-pd-pill-shared-bg text-pd-pill-shared-fg"
                      }`}
                    >
                      {isDelegated
                        ? t("priorityTracker.incoming.delegatedBadge")
                        : t("priorityTracker.incoming.sharedBadge")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {t("priorityTracker.incoming.from", { name: item.fromName })}
                  </p>
                  {preview && (
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      <span aria-hidden="true">📝 </span>
                      {preview}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Story 2.9 -- "Add to board" and "Re-delegate" are
                      delegation-only. A share is visibility, never ownership,
                      so it deliberately gets neither (Stories 1.5/1.8) --
                      this is the one place the prototype was NOT followed. */}
                  {isDelegated && (
                    <>
                      <Button type="button" onClick={() => setAcceptingItem(item)} disabled={busyId === item.id}>
                        {t("priorityTracker.incoming.acceptButton")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setRedelegatingId(item.id)}
                        disabled={busyId === item.id}
                      >
                        {t("priorityTracker.incoming.redelegateButton")}
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="secondary" onClick={() => setOpenTaskId(item.id)}>
                    {t("priorityTracker.incoming.openButton")}
                  </Button>
                </div>

                {!isDelegated && (
                  <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                    {t("priorityTracker.incoming.sharedHint")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {acceptingItem && (
        <AcceptTaskDialog
          taskId={acceptingItem.id}
          taskTitle={acceptingItem.title}
          onClose={() => setAcceptingItem(null)}
          onAccepted={handleAccepted}
        />
      )}

      {/* Read-only: the viewer is either the pending delegate or a share
          recipient, so canEdit is false and the dialog renders no controls.
          The mutation callbacks are unreachable and stay no-ops. */}
      {openTaskId && (
        <TaskDetailDialog
          taskId={openTaskId}
          currentUserId={currentUserId}
          onClose={() => setOpenTaskId(null)}
          onSaved={() => {}}
          onDelegated={() => {}}
          onArchived={() => {}}
        />
      )}

      {redelegatingId && (
        <DelegateTaskDialog onClose={() => setRedelegatingId(null)} onDelegated={handleRedelegated} />
      )}
    </SidePanel>
  );
}
