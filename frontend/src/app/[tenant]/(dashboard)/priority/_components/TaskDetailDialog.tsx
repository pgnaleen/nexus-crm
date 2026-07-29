"use client";

import { useEffect, useState } from "react";
import { PriorityTaskStatus } from "@orelia/common";
import type {
  PriorityTaskHistoryEntry,
  PriorityTaskMessageResponse,
  PriorityTaskResponse,
  PriorityTaskShareResponse,
  UserPickerResponse,
} from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TrashIcon } from "@/components/ui/icons";
import {
  archivePriorityTask,
  completePriorityTask,
  createPriorityTaskMessage,
  getPriorityTask,
  getPriorityTaskHistory,
  listPriorityTaskMessages,
  listPriorityTaskShares,
  removePriorityTaskShare,
  updatePriorityTask,
  updatePriorityTaskProgress,
} from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { PRIORITY_TASK_MESSAGE_EVENT, type PriorityTaskMessagePayload } from "@/lib/realtime/events";
import { getRealtimeSocket } from "@/lib/realtime/socket";
import { useToast } from "@/components/providers/ToastProvider";
import { t } from "@/lib/i18n";
import { DelegateTaskDialog } from "./DelegateTaskDialog";
import { ShareTaskDialog } from "./ShareTaskDialog";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-crm-primary)_15%,transparent)]";

// Story 2.7 -- relative for anything inside the last day, absolute beyond
// that (the prototype's own `fmt`). Safe to read the clock at render time:
// this dialog only ever mounts on a click, so it is never server-rendered and
// can't produce a hydration mismatch.
function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const secondsAgo = (Date.now() - date.getTime()) / 1000;
  if (secondsAgo < 60) return t("priorityTracker.detailDialog.time.justNow");
  if (secondsAgo < 3600) {
    return t("priorityTracker.detailDialog.time.minutesAgo", { value: String(Math.floor(secondsAgo / 60)) });
  }
  if (secondsAgo < 86400) {
    return t("priorityTracker.detailDialog.time.hoursAgo", { value: String(Math.floor(secondsAgo / 3600)) });
  }
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${date.toLocaleTimeString(
    undefined,
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

// Story 1.9 -- render a structured history entry via i18n (the backend
// returns a `kind` + `detail`, never a pre-formatted string).
//
// Story 2.7 -- the actor moved OUT of these strings. The timeline puts the
// event on its own bold line and "{actor} · {time}" beneath it, so leaving
// the actor embedded here would print their name twice on every entry.
function historyLabel(entry: PriorityTaskHistoryEntry): string {
  const name = entry.detail ?? "";
  switch (entry.kind) {
    case "created":
      return t("priorityTracker.detailDialog.history.created");
    case "delegated":
      return t("priorityTracker.detailDialog.history.delegated", { name });
    case "redelegated":
      return t("priorityTracker.detailDialog.history.redelegated", { name });
    case "accepted":
      return t("priorityTracker.detailDialog.history.accepted");
    case "progress":
      return t("priorityTracker.detailDialog.history.progress", { value: name });
    case "completed":
      return t("priorityTracker.detailDialog.history.completed");
    case "archived":
      return t("priorityTracker.detailDialog.history.archived");
    case "restored":
      return t("priorityTracker.detailDialog.history.restored");
    default:
      return entry.kind;
  }
}

function historyMeta(entry: PriorityTaskHistoryEntry): string {
  return t("priorityTracker.detailDialog.history.meta", {
    actor: entry.actorName ?? t("priorityTracker.detailDialog.history.someone"),
    time: formatTimestamp(entry.timestamp),
  });
}

// Story 2.5 -- the seven lifecycle stages, in order. "Created" is index 0 and
// is always already passed: in our data model creating and placing a task are
// the same event (create() writes status "placed" directly), so stageIndex
// never returns 0.
const LIFECYCLE_STEPS = [
  "created",
  "placed",
  "delegated",
  "accepted",
  "inProgress",
  "completed",
  "archived",
] as const;

// Derived from the existing status enum + progress -- deliberately no new
// enum value and no migration. `accepted`/`delegated` are real statuses;
// "in progress" and "created" are not, and don't need to be: progress > 0 is
// exactly what "in progress" means, and creation is implied by existence.
function stageIndex(task: PriorityTaskResponse): number {
  if (task.status === PriorityTaskStatus.Archived) return 6;
  if (task.status === PriorityTaskStatus.Completed || task.progress >= 100) return 5;
  if (task.progress > 0) return 4;
  if (task.status === PriorityTaskStatus.Accepted) return 3;
  if (task.status === PriorityTaskStatus.Delegated) return 2;
  return 1;
}

function LifecycleStepper({ task }: { task: PriorityTaskResponse }) {
  const reached = stageIndex(task);
  const currentLabel = t(`priorityTracker.detailDialog.lifecycle.${LIFECYCLE_STEPS[reached]}`);

  return (
    <div
      className="mt-0.5 mb-1 flex items-start"
      role="img"
      aria-label={t("priorityTracker.detailDialog.lifecycle.stageAriaLabel", { stage: currentLabel })}
    >
      {LIFECYCLE_STEPS.map((step, index) => {
        const isDone = index < reached;
        const isCurrent = index === reached;
        return (
          <div key={step} className="relative flex flex-1 flex-col items-center">
            {/* Connector rail into this step. Spans from the previous dot's
                centre to this one's (left:-50% + w-full), and sits under the
                dots so it never overlaps a numeral. */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-[11px] left-[-50%] z-[1] h-[3px] w-full ${
                  isDone || isCurrent ? "bg-pd-step-done-rail" : "bg-pd-step-idle"
                }`}
              />
            )}
            <span
              className={`relative z-[2] grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-black ${
                isDone
                  ? "bg-pd-pill-done-fg text-white"
                  : isCurrent
                    ? "bg-pd-accent text-white"
                    : "bg-pd-step-idle text-pd-step-idle-fg"
              }`}
            >
              {isDone ? "✓" : index + 1}
            </span>
            <span
              className={`mt-1 text-center text-[9.5px] leading-[1.1] font-extrabold ${
                isDone || isCurrent ? "text-crm-text" : "text-[var(--color-text-muted)]"
              }`}
            >
              {t(`priorityTracker.detailDialog.lifecycle.${step}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SEGMENT_BASE = "h-[22px] flex-1 rounded-md border border-transparent transition-all duration-150";
const SEGMENT_FILLED =
  "[background-image:linear-gradient(180deg,var(--color-pd-prog-end),var(--color-pd-dg-acc))] shadow-[0_3px_7px_-3px_var(--color-pd-dg-acc)]";
const SEGMENT_IDLE = "bg-pd-seg-idle";

// Story 2.6 -- ten discrete blocks in place of the native range slider, so
// the 10%-step rule is visible in the control itself rather than enforced
// invisibly. Rendered for every viewer; only the current owner gets buttons
// (Story 1.7: only the holder of the work moves the number).
function SegmentedProgress({
  value,
  editable,
  disabled,
  onChange,
}: {
  value: number;
  editable: boolean;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: 10 }, (_, index) => {
          const step = (index + 1) * 10;
          const className = `${SEGMENT_BASE} ${step <= value ? SEGMENT_FILLED : SEGMENT_IDLE}`;
          if (!editable) {
            return <span key={step} aria-hidden="true" className={className} />;
          }
          return (
            <button
              key={step}
              type="button"
              disabled={disabled}
              aria-label={t("priorityTracker.detailDialog.setProgressAriaLabel", { value: String(step) })}
              // Clicking the block that already represents the current value
              // steps back down by 10 -- the prototype's toggle, and the only
              // way to walk progress backwards without a second control.
              onClick={() => onChange(step === value ? step - 10 : step)}
              className={`${className} cursor-pointer hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60`}
            />
          );
        })}
      </div>
      <span className="min-w-[58px] text-right text-[22px] font-bold text-pd-dg-acc">{value}%</span>
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
  // Story 1.10 -- archiving drops the task off the active board.
  onArchived: (taskId: string) => void;
}

export function TaskDetailDialog({ taskId, onClose, onSaved, onDelegated, onArchived }: TaskDetailDialogProps) {
  // Story 2.11 -- Complete and Share toast from here; archive/delegate are
  // handed back to the board, which owns their toast so it can't fire twice.
  const { showToast } = useToast();
  const [task, setTask] = useState<PriorityTaskResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sharedWith, setSharedWith] = useState<PriorityTaskShareResponse[]>([]);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDelegateDialogOpen, setIsDelegateDialogOpen] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [history, setHistory] = useState<PriorityTaskHistoryEntry[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);

  // Story 3.3 -- task chat, additive to notes. Loaded for anyone with access
  // to the task (not just the owner) -- broader than isOwner, same rule the
  // backend gates on.
  const [messages, setMessages] = useState<PriorityTaskMessageResponse[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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
    // Story 1.9 -- the real lifecycle history from audit_logs.
    getPriorityTaskHistory(taskId)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        // Non-fatal -- the rest of the detail view still works without it.
      });
    // Story 3.3 -- the chat thread.
    setMessages([]);
    setMessagesError(null);
    listPriorityTaskMessages(taskId)
      .then((fetched) => {
        if (!cancelled) setMessages(fetched);
      })
      .catch((err) => {
        if (!cancelled) {
          setMessagesError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.chat.loadFailed"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Story 3.5 -- live chat delivery, scoped to whichever task this dialog
  // currently has open. Dedupes by message id: the sender's own tab already
  // appended the message from the HTTP response in handleSendMessage, and
  // this same event also reaches them (broadcastMessage includes the
  // sender, for their other open tabs/devices) -- without the dedupe check
  // it would show up twice for whoever just sent it.
  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleMessage = (payload: PriorityTaskMessagePayload) => {
      if (payload.taskId !== taskId) return;
      setMessages((current) =>
        current.some((m) => m.id === payload.message.id) ? current : [...current, payload.message],
      );
    };
    socket.on(PRIORITY_TASK_MESSAGE_EVENT, handleMessage);
    return () => {
      socket.off(PRIORITY_TASK_MESSAGE_EVENT, handleMessage);
    };
  }, [taskId]);

  // Only whoever currently holds the work may edit notes, manage sharing, or
  // move progress. Story 2.4 -- this is `canEdit`, not `ownership === "owned"`:
  // a delegator keeps ownerId until the recipient accepts, so an owner with a
  // pending delegation out would otherwise get full edit controls on work
  // they've already handed off. Covers both read-only cases (merely-shared
  // recipient, and delegator opening their own tracking card).
  const isOwner = task?.canEdit === true;

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

  // Story 1.7 -- owner moves progress in 10% steps. Optimistic-free: await
  // the server (which validates the 10%-step rule) then adopt its response,
  // so the bar and the "ready to close" indicator always reflect the truth.
  async function handleSetProgress(progress: number) {
    if (!task || progress === task.progress) return;
    setIsSavingProgress(true);
    setSaveError(null);
    try {
      const updated = await updatePriorityTaskProgress(task.id, { progress });
      setTask(updated);
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.errors.progressFailed"));
    } finally {
      setIsSavingProgress(false);
    }
  }

  // Story 1.9 -- owner marks the work done (prerequisite for archive).
  async function handleComplete() {
    if (!task) return;
    setIsCompleting(true);
    setSaveError(null);
    try {
      const updated = await completePriorityTask(task.id);
      setTask(updated);
      onSaved(updated);
      const entries = await getPriorityTaskHistory(task.id);
      setHistory(entries);
      showToast({ message: t("priorityTracker.toast.completed") });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.errors.completeFailed"));
    } finally {
      setIsCompleting(false);
    }
  }

  // Story 1.10 -- archive a completed task off the board.
  async function handleArchive() {
    if (!task) return;
    setIsCompleting(true);
    setSaveError(null);
    try {
      await archivePriorityTask(task.id);
      onArchived(task.id);
      onClose();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.errors.archiveFailed"));
    } finally {
      setIsCompleting(false);
    }
  }

  function handleShared(share: PriorityTaskShareResponse) {
    setSharedWith((current) => [...current, share]);
    showToast({ message: t("priorityTracker.toast.shared", { name: share.displayName }) });
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

  // Story 3.3 -- send a chat message. Available to anyone who can open this
  // dialog at all (findOneForUser already gated that), not just the owner.
  async function handleSendMessage() {
    if (!task || !newMessage.trim()) return;
    setIsSendingMessage(true);
    setMessagesError(null);
    try {
      const sent = await createPriorityTaskMessage(task.id, { body: newMessage.trim() });
      setMessages((current) => [...current, sent]);
      setNewMessage("");
    } catch (err) {
      setMessagesError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.chat.sendFailed"));
    } finally {
      setIsSendingMessage(false);
    }
  }

  return (
    <Dialog open title={task?.title ?? t("priorityTracker.detailDialog.loadingTitle")} onClose={onClose} maxWidth="560px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!task && !loadError && (
        <p className="text-sm text-[var(--color-text-muted)]">{t("priorityTracker.detailDialog.loading")}</p>
      )}

      {task && (
        <>
          {/* Story 2.5 -- the lifecycle stepper. This replaces the old
              "Status" text cell in the grid below rather than sitting beside
              it: the stepper shows the same fact (the task's current stage)
              in a strictly richer form, so keeping both would state it twice,
              two lines apart. The grid drops from three columns to two. */}
          <div className="mb-[18px]">
            <p className="mb-2 text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
              {t("priorityTracker.detailDialog.lifecycleLabel")}
            </p>
            <LifecycleStepper task={task} />
          </div>

          <div className="mb-[18px]">
            <p className="mb-1 text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
              {t("priorityTracker.detailDialog.quadrantLabel")}
            </p>
            <p className="text-sm font-medium text-crm-text">
              {t(`priorityTracker.quadrants.${task.quadrant}.label`)}
            </p>
          </div>

          {/* Story 2.6 -- one progress control for every viewer, interactive
              only for whoever currently holds the work (Story 1.7's rule).
              This replaces BOTH the old read-only bar in the grid above and
              the owner-only range slider that sat below it -- two renderings
              of one number, stacked, each with its own "%" readout. */}
          <div className="mb-[18px]">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-[var(--color-text-muted)]">
                {t("priorityTracker.detailDialog.progressLabel")}
              </label>
              {task.progress === 100 && (
                <span className="inline-block rounded-full bg-pd-pill-done-bg px-2.5 py-[2px] text-[11px] font-semibold text-pd-pill-done-fg">
                  {t("priorityTracker.detailDialog.readyToClose")}
                </span>
              )}
            </div>
            <SegmentedProgress
              value={task.progress}
              editable={isOwner}
              disabled={isSavingProgress}
              onChange={handleSetProgress}
            />
            {isOwner && (
              <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">
                {t("priorityTracker.detailDialog.segmentHint")}
              </p>
            )}
            {saveError && <p className="mt-1 text-[12.5px] text-[var(--color-danger)]">{saveError}</p>}
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

          {/* Story 2.8 -- the hint that used to sit beside the Delegate
              button. Delegate moved to the footer, but the share-vs-delegate
              distinction is genuinely non-obvious, so the explanation stays
              here where both actions are in view. */}
          {isOwner && (
            <p className="mb-[18px] text-[12.5px] text-[var(--color-text-muted)]">
              {t("priorityTracker.detailDialog.delegateHint")}
            </p>
          )}

          {/* Story 1.9 -- real lifecycle history from audit_logs, chronological. */}
          <div className="mb-2">
            <p className="mb-2 text-[13px] font-semibold text-[var(--color-text-muted)]">
              {t("priorityTracker.detailDialog.historyLabel")}
            </p>
            {history.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                {t("priorityTracker.detailDialog.historyEmpty")}
              </p>
            ) : (
              /* Story 2.7 -- newest first. The API returns oldest-first
                 (audit_logs ordered occurredAt ASC) and stays that way; this
                 is a presentation-only reversal on a copy, never in place. */
              <ul className="m-0 mt-1.5 flex list-none flex-col p-0">
                {[...history].reverse().map((entry, index, reversed) => (
                  <li key={`${entry.kind}-${entry.timestamp}-${index}`} className="flex gap-2.5 pb-2.5">
                    <span className="relative flex w-3 flex-shrink-0 justify-center">
                      <span className="z-[2] mt-[3px] h-2.5 w-2.5 rounded-full bg-pd-accent" />
                      {/* Rail down to the next dot -- omitted on the last
                          entry so the timeline ends cleanly rather than
                          trailing into empty space. */}
                      {index < reversed.length - 1 && (
                        <span aria-hidden="true" className="absolute top-2 bottom-[-4px] w-0.5 bg-pd-timeline-rail" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold text-crm-text">{historyLabel(entry)}</span>
                      <span className="block text-[11px] font-bold text-[var(--color-text-muted)]">
                        {historyMeta(entry)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Story 3.3 -- task chat, additive to notes. Open to anyone who
              can see this dialog at all, not just the owner. */}
          <div className="mb-2 border-t border-[var(--color-border)] pt-3">
            <p className="mb-2 text-[13px] font-semibold text-[var(--color-text-muted)]">
              {t("priorityTracker.detailDialog.chat.label")}
            </p>
            {messages.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                {t("priorityTracker.detailDialog.chat.empty")}
              </p>
            ) : (
              <ul className="m-0 mb-2 flex max-h-[180px] list-none flex-col gap-2 overflow-y-auto p-0">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
                  >
                    <div className="mb-0.5 flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-crm-text">{message.authorName}</span>
                      <span className="flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <p className="m-0 text-[13px] whitespace-pre-wrap text-crm-text">{message.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {messagesError && <p className="mb-1.5 text-[12.5px] text-[var(--color-danger)]">{messagesError}</p>}
            <div className="flex items-end gap-2">
              <textarea
                className={TEXTAREA_CLASS}
                rows={2}
                value={newMessage}
                placeholder={t("priorityTracker.detailDialog.chat.placeholder")}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleSendMessage}
                isLoading={isSendingMessage}
                disabled={!newMessage.trim()}
              >
                {t("priorityTracker.detailDialog.chat.sendButton")}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Story 2.8 -- one action footer, replacing the three separate
          bordered hint-rows that each carried a single button. Complete and
          Delegate/Re-delegate lead; Archive and Close sit right, matching the
          prototype's footer. */}
      <div className="mt-2 flex flex-wrap items-center gap-2.5 border-t border-[var(--color-border)] pt-3">
        {task && isOwner && task.status !== PriorityTaskStatus.Completed && task.status !== PriorityTaskStatus.Archived && (
          <Button type="button" onClick={handleComplete} isLoading={isCompleting}>
            {t("priorityTracker.detailDialog.completeButton")}
          </Button>
        )}
        {task && isOwner && (
          <Button type="button" variant="secondary" onClick={() => setIsDelegateDialogOpen(true)}>
            {/* Same operation either way -- POST /priority-tasks/:id/delegate.
                Only the wording changes: handing on something that reached me
                via someone else's delegation is a re-delegation, so calling it
                "Delegate" would hide the chain the user is extending. */}
            {task.isCreator
              ? t("priorityTracker.detailDialog.delegateButton")
              : t("priorityTracker.detailDialog.redelegateButton")}
          </Button>
        )}
        <div className="flex-1" />
        {task && isOwner && task.status === PriorityTaskStatus.Completed && (
          <Button type="button" variant="secondary" onClick={handleArchive} isLoading={isCompleting}>
            {t("priorityTracker.detailDialog.archiveButton")}
          </Button>
        )}
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
