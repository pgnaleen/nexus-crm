"use client";

import { useEffect, useRef, useState } from "react";
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
import { EditIcon, TrashIcon, PriorityIcon, ClockIcon, ActivityIcon } from "@/components/ui/icons";
import {
  archivePriorityTask,
  completePriorityTask,
  createPriorityTaskMessage,
  deletePriorityTaskMessage,
  getPriorityTask,
  getPriorityTaskHistory,
  listPriorityTaskMessages,
  listPriorityTaskShares,
  removePriorityTaskShare,
  updatePriorityTask,
  updatePriorityTaskMessage,
  updatePriorityTaskProgress,
} from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { PRIORITY_TASK_MESSAGE_EVENT, type PriorityTaskMessagePayload } from "@/lib/realtime/events";
import { getRealtimeSocket } from "@/lib/realtime/socket";
import { useConfirm } from "@/components/providers/DialogProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { t } from "@/lib/i18n";
import { DelegateTaskDialog } from "./DelegateTaskDialog";
import { ShareTaskDialog } from "./ShareTaskDialog";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 focus:border-crm-primary focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-crm-primary)_15%,transparent)]";

// Every tab panel gets this same fixed height + internal scroll, per
// CLAUDE.md's "Multi-tab dialogs: fixed panel size across tabs" rule --
// the dialog's footprint never changes when switching tabs. 420px: this
// dialog (maxWidth 560px) is notably narrower than AddDealDialog (the
// documented 620px reference), closer to EmployeeDetailDialog's 380px
// precedent, but General has more distinct sections than any of that
// dialog's grid tabs.
const TAB_PANEL_HEIGHT = "h-[420px]";

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

// Feature-local copy, same precedent as this file's own formatTimestamp
// duplicating Deal Notes' formatNoteTime rather than importing across
// feature boundaries -- see frontend/src/lib/deals/deal-display.ts's own
// getInitials for the twin.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

// Story 1.9 -- render a structured history entry via i18n (the backend
// returns a `kind` + `detail`, never a pre-formatted string).
//
// Story 2.7 -- the actor moved OUT of these strings. The timeline puts the
// event on its own bold line and "{actor} · {time}" beneath it, so leaving
// the actor embedded here would print their name twice on every entry.
//
// `accepted` carries the quadrant the acceptor chose in `detail` (the raw
// enum value, e.g. "decide") once the backend fix ships -- older rows
// recorded before that fix have no quadrant in their audit changes, so
// `detail` is null for them and this falls back to the old plain string.
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
      return entry.detail
        ? t("priorityTracker.detailDialog.history.acceptedIntoQuadrant", {
            quadrant: t(`priorityTracker.quadrants.${entry.detail}.label`),
          })
        : t("priorityTracker.detailDialog.history.accepted");
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

type TabId = "general" | "history" | "discussion";
const TAB_IDS: TabId[] = ["general", "history", "discussion"];

interface TaskDetailDialogProps {
  taskId: string;
  // Drives the Discussion tab's own-vs-other bubble alignment.
  currentUserId: string;
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

export function TaskDetailDialog({
  taskId,
  currentUserId,
  onClose,
  onSaved,
  onDelegated,
  onArchived,
}: TaskDetailDialogProps) {
  // Story 2.11 -- Complete and Share toast from here; archive/delegate are
  // handed back to the board, which owns their toast so it can't fire twice.
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabId>("general");
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
  const [historyVisibleCount, setHistoryVisibleCount] = useState(5);
  const [isCompleting, setIsCompleting] = useState(false);

  // Task chat, additive to notes. Loaded for anyone with access to the task
  // (not just the owner) -- broader than isOwner, same rule the backend
  // gates on.
  const [messages, setMessages] = useState<PriorityTaskMessageResponse[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesVisibleCount, setMessagesVisibleCount] = useState(15);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [isSavingMessageEdit, setIsSavingMessageEdit] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setActiveTab("general");
    setTask(null);
    setLoadError(null);
    setHistoryVisibleCount(5);
    setMessagesVisibleCount(15);
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
    // Task chat thread.
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

  // The single place any message write (send/edit/delete, from this tab's
  // own HTTP response OR a realtime echo of either) lands in state --
  // append if the id is new, replace in place if it already exists. This is
  // what makes the arrival order of "my own HTTP response" vs. "the
  // realtime broadcast of my own action" not matter: the backend emits the
  // broadcast *before* the HTTP response is even finished being sent back
  // (see PriorityTaskMessagesService.add's own ordering), so the socket
  // event can genuinely reach this tab first. Two call sites each doing
  // their own dedupe/replace independently (as this used to be written)
  // left a gap: the HTTP-response path had no dedupe check at all, so
  // whichever path lost the race duplicated the message instead of no-op'ing.
  function upsertMessage(message: PriorityTaskMessageResponse) {
    setMessages((current) =>
      current.some((m) => m.id === message.id)
        ? current.map((m) => (m.id === message.id ? message : m))
        : [...current, message],
    );
  }

  // Live chat delivery, scoped to whichever task this dialog currently has
  // open.
  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleMessage = (payload: PriorityTaskMessagePayload) => {
      if (payload.taskId !== taskId) return;
      upsertMessage(payload.message);
    };
    socket.on(PRIORITY_TASK_MESSAGE_EVENT, handleMessage);
    return () => {
      socket.off(PRIORITY_TASK_MESSAGE_EVENT, handleMessage);
    };
    // upsertMessage only closes over setMessages (a stable dispatch
    // function), so omitting it here is safe -- which render's copy runs is
    // behaviorally identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Chat-style auto-scroll: jump to the newest message when a new one
  // arrives (send, or a realtime "created" event) -- deliberately keyed to
  // the last message's own id, not messages.length or messagesVisibleCount,
  // so revealing older messages via "Load earlier" never yanks the view.
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (activeTab === "discussion") {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId, activeTab]);

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

  // Send a chat message. Available to anyone who can open this dialog at
  // all (findOneForUser already gated that), not just the owner.
  async function handleSendMessage() {
    if (!task || !newMessage.trim()) return;
    setIsSendingMessage(true);
    setMessagesError(null);
    try {
      const sent = await createPriorityTaskMessage(task.id, { body: newMessage.trim() });
      upsertMessage(sent);
      setNewMessage("");
    } catch (err) {
      setMessagesError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.chat.sendFailed"));
    } finally {
      setIsSendingMessage(false);
    }
  }

  function handleStartEditMessage(message: PriorityTaskMessageResponse) {
    setEditingMessageId(message.id);
    setEditMessageDraft(message.body);
  }

  function handleCancelEditMessage() {
    setEditingMessageId(null);
    setEditMessageDraft("");
  }

  async function handleSaveEditMessage(messageId: string) {
    if (!task || !editMessageDraft.trim()) return;
    setIsSavingMessageEdit(true);
    setMessagesError(null);
    try {
      const updated = await updatePriorityTaskMessage(task.id, messageId, { body: editMessageDraft.trim() });
      upsertMessage(updated);
      setEditingMessageId(null);
      setEditMessageDraft("");
    } catch (err) {
      setMessagesError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.chat.editFailed"));
    } finally {
      setIsSavingMessageEdit(false);
    }
  }

  async function handleDeleteMessage(message: PriorityTaskMessageResponse) {
    if (!task) return;
    const confirmed = await confirm({
      title: t("priorityTracker.detailDialog.chat.deleteConfirmTitle"),
      message: t("priorityTracker.detailDialog.chat.deleteConfirmMessage"),
      confirmLabel: t("common.actions.delete"),
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      const deleted = await deletePriorityTaskMessage(task.id, message.id);
      upsertMessage(deleted);
    } catch (err) {
      setMessagesError(err instanceof ApiError ? err.message : t("priorityTracker.detailDialog.chat.deleteFailed"));
    }
  }

  const reversedHistory = [...history].reverse();
  const visibleHistory = reversedHistory.slice(0, historyVisibleCount);
  const visibleMessages = messages.slice(Math.max(0, messages.length - messagesVisibleCount));

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <PriorityIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">
          {t("priorityTracker.detailDialog.tabs.general")}
        </span>
        {task && (
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5 truncate">
            {task.title}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open title={dialogTitle} onClose={onClose} maxWidth="560px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!task && !loadError && (
        <p className="text-sm text-[var(--color-text-muted)]">{t("priorityTracker.detailDialog.loading")}</p>
      )}

      {task && (
        <>
          {/* Pill tab strip — matches AddDealDialog.tsx's named reference pattern */}
          <div className="relative mb-5">
            <div className="flex flex-nowrap items-center bg-slate-100/90 p-1 rounded-xl select-none border border-slate-200/40 shadow-sm w-full gap-1">
              {TAB_IDS.map((id, idx) => {
                const isActive = activeTab === id;
                let icon = null;
                if (id === "general") icon = <PriorityIcon size={14} />;
                else if (id === "history") icon = <ClockIcon size={14} />;
                else if (id === "discussion") icon = <ActivityIcon size={14} />;

                const isFirst = idx === 0;
                const isLast = idx === TAB_IDS.length - 1;
                let clipPath = "";
                if (isActive) {
                  if (isFirst) clipPath = "polygon(0 0, 100% 0, 88% 100%, 0 100%)";
                  else if (isLast) clipPath = "polygon(12% 0, 100% 0, 100% 100%, 0 100%)";
                  else clipPath = "polygon(12% 0, 100% 0, 88% 100%, 0 100%)";
                }

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 py-1.5 px-3 font-bold transition-all duration-150 border-none outline-none focus:outline-none cursor-pointer rounded-lg ${
                      isActive ? "text-white select-none" : "text-slate-550 hover:bg-slate-200/50 hover:text-slate-800"
                    }`}
                  >
                    {isActive && (
                      <div
                        className={`absolute inset-0 bg-crm-primary shadow-sm ${
                          isFirst ? "rounded-l-lg" : isLast ? "rounded-r-lg" : ""
                        }`}
                        style={{ clipPath }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5 text-[12.5px] whitespace-nowrap">
                      {icon}
                      {t(`priorityTracker.detailDialog.tabs.${id}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "general" && (
            <div className={`${TAB_PANEL_HEIGHT} overflow-y-auto pr-1`}>
              {/* Story 2.5 -- the lifecycle stepper. */}
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
                  only for whoever currently holds the work (Story 1.7's rule). */}
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
                  button. */}
              {isOwner && (
                <p className="mb-[18px] text-[12.5px] text-[var(--color-text-muted)]">
                  {t("priorityTracker.detailDialog.delegateHint")}
                </p>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className={`${TAB_PANEL_HEIGHT} overflow-y-auto pr-1`}>
              {history.length === 0 ? (
                <p className="text-[12.5px] text-[var(--color-text-muted)]">
                  {t("priorityTracker.detailDialog.historyEmpty")}
                </p>
              ) : (
                <>
                  {/* Story 2.7 -- newest first. The API returns oldest-first
                      (audit_logs ordered occurredAt ASC) and stays that way;
                      this is a presentation-only reversal on a copy. */}
                  <ul className="m-0 mt-0.5 flex list-none flex-col p-0">
                    {visibleHistory.map((entry, index) => (
                      <li key={`${entry.kind}-${entry.timestamp}-${index}`} className="flex gap-2.5 pb-2.5">
                        <span className="relative flex w-3 flex-shrink-0 justify-center">
                          <span className="z-[2] mt-[3px] h-2.5 w-2.5 rounded-full bg-pd-accent" />
                          {index < visibleHistory.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="absolute top-2 bottom-[-4px] w-0.5 bg-pd-timeline-rail"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-extrabold text-crm-text">
                            {historyLabel(entry)}
                          </span>
                          <span className="block text-[11px] font-bold text-[var(--color-text-muted)]">
                            {historyMeta(entry)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {reversedHistory.length > historyVisibleCount && (
                    <button
                      type="button"
                      className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-crm-primary hover:underline"
                      onClick={() => setHistoryVisibleCount((n) => n + 10)}
                    >
                      {t("priorityTracker.detailDialog.history.seeMoreButton")}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "discussion" && (
            <div className={`flex ${TAB_PANEL_HEIGHT} flex-col`}>
              <div className="flex-1 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">
                    {t("priorityTracker.detailDialog.chat.empty")}
                  </p>
                ) : (
                  <>
                    {messages.length > messagesVisibleCount && (
                      <div className="mb-3 flex justify-center">
                        <button
                          type="button"
                          className="cursor-pointer rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-crm-text"
                          onClick={() => setMessagesVisibleCount((n) => n + 25)}
                        >
                          {t("priorityTracker.detailDialog.chat.loadEarlierButton")}
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col gap-4">
                      {visibleMessages.map((message) => {
                        const isOwn = message.userId === currentUserId;
                        const isEditing = editingMessageId === message.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex items-start gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                          >
                            <div
                              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-[0.02em] text-white ${
                                message.isDeleted
                                  ? "bg-[var(--color-text-muted)]/50"
                                  : isOwn
                                    ? "bg-crm-primary"
                                    : "bg-[var(--color-text-muted)]"
                              }`}
                              aria-hidden="true"
                            >
                              {getInitials(message.authorName || "?")}
                            </div>
                            <div
                              className={`min-w-0 max-w-[78%] rounded-bl-[16px] rounded-br-[16px] px-3 py-2 ${
                                message.isDeleted
                                  ? "border border-dashed border-[var(--color-border)] bg-transparent"
                                  : `shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${isOwn ? "bg-crm-primary-tint" : "bg-[var(--color-bg)]"}`
                              } ${isOwn ? "rounded-tr-[6px] rounded-tl-[16px]" : "rounded-tl-[6px] rounded-tr-[16px]"}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12.5px] font-semibold text-crm-text">
                                  {message.authorName}
                                </span>
                                <span className="flex-1 text-[10.5px] text-[var(--color-text-muted)]">
                                  {formatTimestamp(message.createdAt)}
                                </span>
                                {message.editedAt && !message.isDeleted && (
                                  <span className="text-[10.5px] text-[var(--color-text-muted)] italic">
                                    {t("priorityTracker.detailDialog.chat.editedLabel")}
                                  </span>
                                )}
                                {isOwn && !message.isDeleted && !isEditing && (
                                  <>
                                    <button
                                      type="button"
                                      className="flex flex-shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-1 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-crm-primary-tint hover:text-crm-primary"
                                      aria-label={t("priorityTracker.detailDialog.chat.editAriaLabel")}
                                      onClick={() => handleStartEditMessage(message)}
                                    >
                                      <EditIcon size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="flex flex-shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-1 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                                      aria-label={t("priorityTracker.detailDialog.chat.deleteAriaLabel")}
                                      onClick={() => handleDeleteMessage(message)}
                                    >
                                      <TrashIcon size={12} />
                                    </button>
                                  </>
                                )}
                              </div>

                              {message.isDeleted ? (
                                <p className="mt-1 text-[13px] text-[var(--color-text-muted)] italic">
                                  {t("priorityTracker.detailDialog.chat.deletedPlaceholder")}
                                </p>
                              ) : isEditing ? (
                                <>
                                  <textarea
                                    className={`${TEXTAREA_CLASS} mt-1`}
                                    rows={2}
                                    value={editMessageDraft}
                                    onChange={(e) => setEditMessageDraft(e.target.value)}
                                  />
                                  <div className="mt-1.5 flex justify-end gap-1.5">
                                    <Button type="button" variant="secondary" onClick={handleCancelEditMessage}>
                                      {t("common.actions.cancel")}
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => handleSaveEditMessage(message.id)}
                                      isLoading={isSavingMessageEdit}
                                      disabled={!editMessageDraft.trim()}
                                    >
                                      {t("common.actions.save")}
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <p className="mt-0.5 text-[13px] whitespace-pre-wrap text-crm-text">{message.body}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              {messagesError && <p className="mt-1.5 mb-1.5 text-[12.5px] text-[var(--color-danger)]">{messagesError}</p>}
              <div className="flex items-end gap-2 border-t border-[var(--color-border)] pt-3">
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
          )}
        </>
      )}

      {/* Story 2.8 -- one action footer, replacing the three separate
          bordered hint-rows that each carried a single button. Complete and
          Delegate/Re-delegate lead; Archive and Close sit right, matching the
          prototype's footer. Stays outside every tab. */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-[var(--color-border)] pt-3">
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
