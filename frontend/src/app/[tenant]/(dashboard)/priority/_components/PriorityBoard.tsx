"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  PriorityTaskQuadrant,
  PriorityTaskStatus,
  type PriorityTaskDelegationTrackerResponse,
  type PriorityTaskFlowHopSummary,
  type PriorityTaskResponse,
  type UserPickerResponse,
} from "@orelia/common";
import { t } from "@/lib/i18n";
import { PlusIcon } from "@/components/ui/icons";
import {
  delegatePriorityTask,
  listIncomingPriorityTasks,
  listPriorityTaskDelegationTrackers,
  listPriorityTasks,
  movePriorityTask,
} from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { PRIORITY_TASK_FLOW_CHANGED_EVENT } from "@/lib/realtime/events";
import { getRealtimeSocket } from "@/lib/realtime/socket";
import { useAlert } from "@/components/providers/DialogProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ArchivePanelDialog } from "./ArchivePanelDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { IncomingPanelDialog } from "./IncomingPanelDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { DEFAULT_QUADRANT, QUADRANT_ORDER, QUADRANT_STYLE, QUADRANTS, type QuadrantConfig } from "./types";

// Story 1.1 (View/Navigate) + 1.2 (Create) + 1.3 (Drag-and-drop reorder) --
// backed by the real /priority-tasks API throughout. Reordering/quadrant
// moves apply optimistically (the board reflows immediately as you drag),
// then persist via PATCH .../:id/move; a failed save rolls the board back
// to exactly how it looked before the drag and surfaces an error.

// Story 2.2 -- the matrix axis labels. Shown from `md:` up only, where the
// board is actually a 2x2 grid; on a single-column mobile layout there are no
// columns or rows for them to label.
// Story 2.12 -- one glyph per quadrant, so an empty panel hints at what
// belongs in it rather than repeating the same line four times. Kept local
// to the board: types.ts's QUADRANT_STYLE is shared with the accept dialog,
// which has no empty state to render.
const EMPTY_STATE_GLYPH: Record<PriorityTaskQuadrant, string> = {
  [PriorityTaskQuadrant.Do]: "⚡",
  [PriorityTaskQuadrant.Decide]: "🗓️",
  [PriorityTaskQuadrant.Delegate]: "🤝",
  [PriorityTaskQuadrant.Delete]: "🧹",
};

const AXIS_LABEL_CLASS =
  "text-[12px] font-semibold tracking-[0.14em] text-[var(--color-text-muted)] uppercase";

function buildOrder(tasks: PriorityTaskResponse[]): Record<PriorityTaskQuadrant, string[]> {
  const order = Object.fromEntries(QUADRANT_ORDER.map((q) => [q, [] as string[]])) as Record<
    PriorityTaskQuadrant,
    string[]
  >;
  for (const task of tasks) {
    order[task.quadrant].push(task.id);
  }
  return order;
}

// Story 2.3 -- one pill shape, six colour pairings. Written out as literal
// class strings (not composed from `tone`) because Tailwind scans source as
// text and would generate nothing for an interpolated class name.
const PILL_BASE =
  "inline-flex flex-shrink-0 items-center gap-1 rounded-full px-[7px] py-[2px] text-[10.5px] font-extrabold";
const PILL_TONE = {
  mine: "bg-pd-pill-mine-bg text-pd-pill-mine-fg",
  track: "bg-pd-pill-track-bg text-pd-pill-track-fg",
  shared: "bg-pd-pill-shared-bg text-pd-pill-shared-fg",
  recv: "bg-pd-pill-recv-bg text-pd-pill-recv-fg",
  note: "bg-pd-pill-note-bg text-pd-pill-note-fg",
  done: "bg-pd-pill-done-bg text-pd-pill-done-fg",
} as const;

function Pill({
  tone,
  glyph,
  srLabel,
  children,
}: {
  tone: keyof typeof PILL_TONE;
  glyph: string;
  // For pills whose visible text is deliberately terse (the delegation pill
  // renders just "→ Amara"), so a screen reader still gets the full meaning.
  srLabel?: string;
  children: string;
}) {
  return (
    <span className={`${PILL_BASE} ${PILL_TONE[tone]}`} {...(srLabel ? { "aria-label": srLabel } : {})}>
      <span aria-hidden="true">{glyph}</span>
      {children}
    </span>
  );
}

// Story 2.3 -- the card's inline progress bar. Only rendered when there's
// progress to show; an empty bar on every card is noise, not information.
function CardProgress({ progress }: { progress: number }) {
  return (
    <div className="mt-[7px] flex items-center gap-1.5">
      <div className="h-[7px] flex-1 overflow-hidden rounded-md bg-pd-prog-track">
        <div
          className="h-full rounded-md transition-[width] duration-300 ease-out [background-image:linear-gradient(90deg,var(--color-pd-dg-acc),var(--color-pd-prog-end))]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span
        className="min-w-[30px] text-right text-[11px] font-bold text-[var(--color-text-muted)]"
        aria-label={t("priorityTracker.cardProgressAriaLabel", { value: String(progress) })}
      >
        {progress}%
      </span>
    </div>
  );
}

// The board card's "who moved it where" preview, e.g. "Ben(Decide) ->
// Sam(Do)". Sourced server-side from priority_task_flow, oldest-first here
// (the API returns newest-first, reversed on a copy for display) -- same
// "backend picks a stable order, frontend reverses a presentational copy
// when the two disagree" pattern TaskDetailDialog's own history list uses.
// Only rendered for >=2 hops: a single-hop task (never moved) has nothing
// resembling a "chain" worth a line, and would just add noise to every
// fresh card on the board.
function FlowHopsPreview({ hops }: { hops: PriorityTaskFlowHopSummary[] }) {
  if (hops.length < 2) return null;
  const ordered = [...hops].reverse();
  return (
    <div className="mt-1 truncate text-[11px] font-medium text-[var(--color-text-muted)]">
      {ordered.map((hop, index) => (
        <span key={`${hop.userId}-${hop.timestamp}`}>
          {index > 0 && " → "}
          {hop.userName}({t(`priorityTracker.quadrants.${hop.quadrant}.label`)})
        </span>
      ))}
    </div>
  );
}

// A task with a pending delegation is removed from the board entirely
// (see findAllForUser's delegatedToUserId filter) -- its delegator-side
// representation is a TrackerCard instead, never this component, so
// TaskCard/SortableTaskCard never need to know about delegation.
//
// The prototype's "Shared by {name}" pill has no reachable case here: this
// card only ever renders on your own board, and findAllForUser returns
// nothing but tasks you own. A merely-shared task lives in the Incoming
// panel and the detail dialog, never as a board card -- so that pill belongs
// to those surfaces, not this one.
function TaskCard({ task, rank, accentClass }: { task: PriorityTaskResponse; rank: number; accentClass: string }) {
  const isOwned = task.ownership === "owned";
  const hasNotes = Boolean(task.notes && task.notes.trim());

  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,var(--color-pd-pill-mine-fg)_8%,transparent)] bg-white py-2.5 pr-3 pl-2.5 shadow-sm transition-[transform,box-shadow] duration-100 hover:-translate-y-px hover:shadow-md">
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white ${accentClass}`}
      >
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-sm leading-[1.25] font-extrabold break-words text-crm-text">{task.title}</div>

        <div className="mt-1.5 flex flex-wrap items-center gap-[5px]">
          {isOwned && task.isCreator && (
            <Pill tone="mine" glyph="✦">
              {t("priorityTracker.badge.mine")}
            </Pill>
          )}
          {isOwned && !task.isCreator && (
            <Pill tone="recv" glyph="↩">
              {t("priorityTracker.badge.assignedToMe")}
            </Pill>
          )}
          {isOwned && task.shareCount > 0 && (
            <Pill tone="shared" glyph="👁">
              {t("priorityTracker.badge.shared")}
            </Pill>
          )}
          {hasNotes && (
            <Pill tone="note" glyph="📝">
              {t("priorityTracker.badge.note")}
            </Pill>
          )}
          {task.status === PriorityTaskStatus.Completed && (
            <Pill tone="done" glyph="✓">
              {t("priorityTracker.badge.done")}
            </Pill>
          )}
        </div>

        <FlowHopsPreview hops={task.recentFlowHops} />
        {task.progress > 0 && <CardProgress progress={task.progress} />}
      </div>

      <span aria-hidden="true" className="flex-shrink-0 self-center p-0.5 text-[15px] text-pd-chevron">
        ›
      </span>
    </div>
  );
}

function SortableTaskCard({
  task,
  rank,
  accentClass,
  onOpen,
}: {
  task: PriorityTaskResponse;
  rank: number;
  accentClass: string;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Story 2.3 -- the prototype's drag opacity; the DragOverlay carries the
    // fully-rendered card, so the source only needs to read as "lifted".
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={t("priorityTracker.openTaskAriaLabel", { title: task.title })}
      className="relative z-10 cursor-grab touch-none active:cursor-grabbing"
      onClick={() => onOpen(task.id)}
    >
      <TaskCard task={task} rank={rank} accentClass={accentClass} />
    </div>
  );
}

// Story 1.6 -- the delegator's own read-only breadcrumb for something
// they've handed off. Deliberately not draggable/sortable (it isn't a real
// task placement, just a live-joined reference) and not clickable yet --
// accepting/re-delegating/cancelling are Story 1.8 territory.
// Story 2.4 -- the delegator's own card for something they've handed off.
// Same anatomy as a real task card (accent chip, solid surface, pills,
// progress) rather than the dashed translucent stub it started as: the
// DELEGATE quadrant should read as a live dashboard of outstanding work, not
// a list of greyed-out references.
//
// It is deliberately outside the SortableContext, so it isn't draggable at
// all -- that's how "dragging a tracking card snaps it back to DELEGATE"
// (AC 2.4) is satisfied: a tracking card is a reference to a delegation, not
// a placement the delegator owns, so it can never leave this quadrant.
function TrackerCard({
  tracker,
  rank,
  accentClass,
  onOpen,
}: {
  tracker: PriorityTaskDelegationTrackerResponse;
  rank: number;
  accentClass: string;
  onOpen: (taskId: string) => void;
}) {
  // Pending until the recipient accepts -- at which point accept() flips the
  // task's own status to Accepted, so the task's status is the signal here
  // (the tracker row itself carries no accepted flag).
  const isPending = tracker.taskStatus === PriorityTaskStatus.Delegated;
  const label = isPending
    ? t("priorityTracker.badge.delegatedToPending", { name: tracker.delegatedToName })
    : t("priorityTracker.badge.delegatedTo", { name: tracker.delegatedToName });
  const srLabel = isPending
    ? t("priorityTracker.badge.delegatedToPendingSr", { name: tracker.delegatedToName })
    : t("priorityTracker.badge.delegatedToSr", { name: tracker.delegatedToName });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("priorityTracker.openTaskAriaLabel", { title: tracker.taskTitle })}
      onClick={() => onOpen(tracker.taskId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(tracker.taskId);
        }
      }}
      className="flex cursor-pointer items-start gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,var(--color-pd-pill-mine-fg)_8%,transparent)] bg-white py-2.5 pr-3 pl-2.5 text-left shadow-sm transition-[transform,box-shadow] duration-100 hover:-translate-y-px hover:shadow-md"
    >
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white ${accentClass}`}
      >
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-sm leading-[1.25] font-extrabold break-words text-crm-text">{tracker.taskTitle}</div>

        <div className="mt-1.5 flex flex-wrap items-center gap-[5px]">
          <Pill tone="track" glyph="→" srLabel={srLabel}>
            {label}
          </Pill>
          {tracker.taskStatus === PriorityTaskStatus.Completed && (
            <Pill tone="done" glyph="✓">
              {t("priorityTracker.badge.done")}
            </Pill>
          )}
        </div>

        <FlowHopsPreview hops={tracker.recentFlowHops} />
        {/* Live-joined to the real task on every fetch, never a snapshot
            frozen at delegation time -- so the recipient's progress shows up
            here as they move it. */}
        {tracker.taskProgress > 0 && <CardProgress progress={tracker.taskProgress} />}
      </div>

      <span aria-hidden="true" className="flex-shrink-0 self-center p-0.5 text-[15px] text-pd-chevron">
        ›
      </span>
    </div>
  );
}

function QuadrantPanel({
  config,
  taskIds,
  taskById,
  trackers,
  onAddClick,
  onOpenTask,
}: {
  config: QuadrantConfig;
  taskIds: string[];
  taskById: Record<string, PriorityTaskResponse>;
  trackers: PriorityTaskDelegationTrackerResponse[];
  onAddClick: (quadrant: PriorityTaskQuadrant) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: config.id });
  const label = t(`priorityTracker.quadrants.${config.id}.label`);
  const tasks = taskIds.map((id) => taskById[id]).filter((task): task is PriorityTaskResponse => Boolean(task));
  // Story 2.2 -- the header count is "cards visible in this quadrant", so the
  // delegator's own tracking cards count too (they only ever land in DELEGATE).
  const cardCount = tasks.length + trackers.length;

  return (
    <div
      className={`relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-transparent p-4 ${config.panelClass}`}
    >
      {/* Watermark sits in the reserved bottom padding (pb-16 on the list
          below), so however many cards stack up they never cover the action
          word -- it stays a visible translucent watermark (AC 1.1). Scales
          down on narrow viewports the way the prototype does, so it never
          overruns a single-column panel. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-2 bottom-0 z-0 text-[40px] leading-[0.8] font-extrabold tracking-[-0.02em] opacity-85 select-none sm:text-[52px] lg:text-[74px] ${config.watermarkClass}`}
      >
        {config.watermark}
      </span>

      <div className="relative z-10 mb-3 flex flex-shrink-0 items-center gap-2">
        <span aria-hidden="true" className={`h-[11px] w-[11px] flex-shrink-0 rounded-full ${config.dotClass}`} />
        <h2 className="min-w-0 truncate text-[13.5px] font-semibold text-crm-text">
          <b className="font-bold">{t(`priorityTracker.quadrants.${config.id}.number`)}</b>
          {" · "}
          {t(`priorityTracker.quadrants.${config.id}.sublabel`)}
        </h2>
        <span
          className="ml-auto flex-shrink-0 text-[11px] font-extrabold text-[var(--color-text-muted)]"
          aria-label={t("priorityTracker.quadrantCountAriaLabel", {
            count: String(cardCount),
            quadrant: label,
          })}
        >
          {cardCount}
        </span>
        <button
          type="button"
          aria-label={t("priorityTracker.addToQuadrantAriaLabel", { quadrant: label })}
          className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-white/70 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-white hover:text-crm-primary"
          onClick={() => onAddClick(config.id)}
        >
          <PlusIcon size={14} />
        </button>
      </div>

      <div ref={setNodeRef} className="relative z-10 flex flex-1 flex-col gap-2.5 pb-16">
        {/* Tracking cards sit above the real task cards and share one
            continuous rank sequence with them (Story 1.1: "numbered
            continuously starting at 1 at the top"), so a DELEGATE quadrant
            holding 2 trackers and 2 tasks reads 1-2-3-4, not blank-blank-1-2. */}
        {trackers.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {trackers.map((tracker, index) => (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                rank={index + 1}
                accentClass={config.accentClass}
                onOpen={onOpenTask}
              />
            ))}
          </div>
        )}
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 && trackers.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 text-center">
              <span aria-hidden="true" className="mb-1 block text-[26px] opacity-60">
                {EMPTY_STATE_GLYPH[config.id]}
              </span>
              <p className="text-[12.5px] font-bold text-[var(--color-text-muted)] opacity-80">
                {t(`priorityTracker.emptyState.${config.id}`)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {tasks.map((task, index) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  rank={trackers.length + index + 1}
                  accentClass={config.accentClass}
                  onOpen={onOpenTask}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

interface PriorityBoardProps {
  initialTasks: PriorityTaskResponse[];
  initialDelegationTrackers: PriorityTaskDelegationTrackerResponse[];
  // Drives the task detail dialog's Discussion tab own-vs-other bubble
  // alignment -- threaded down from the server component, which already
  // has the session in scope.
  currentUserId: string;
}

export function PriorityBoard({ initialTasks, initialDelegationTrackers, currentUserId }: PriorityBoardProps) {
  const [taskById, setTaskById] = useState<Record<string, PriorityTaskResponse>>(() =>
    Object.fromEntries(initialTasks.map((task) => [task.id, task])),
  );
  const [order, setOrder] = useState<Record<PriorityTaskQuadrant, string[]>>(() => buildOrder(initialTasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createDialogQuadrant, setCreateDialogQuadrant] = useState<PriorityTaskQuadrant | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Story 1.6 (Delegate) -- the delegator's own tracking cards for the
  // DELEGATE quadrant, real/backed by GET /priority-tasks/delegated-trackers.
  const [delegationTrackers, setDelegationTrackers] =
    useState<PriorityTaskDelegationTrackerResponse[]>(initialDelegationTrackers);
  // Story 1.8 -- Incoming panel: count for the header badge, opened on demand.
  const [incomingCount, setIncomingCount] = useState(0);
  const [isIncomingOpen, setIsIncomingOpen] = useState(false);
  // Story 1.10 -- Archive view.
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const { showError } = useAlert();
  // Story 2.11 -- confirmations only. Failures keep the existing showError
  // alert path: a toast that auto-dismisses in ~2s is the wrong place for
  // something the user has to act on, and can be missed by looking away.
  //
  // The board is the single toast point for anything a child dialog hands
  // back (accept, archive, restore, delegate) -- toasting in both the dialog
  // and here would fire twice for one action.
  const { showToast } = useToast();

  useEffect(() => {
    listIncomingPriorityTasks()
      .then((items) => setIncomingCount(items.length))
      .catch(() => {
        // Non-fatal -- the badge just stays at 0 if the count can't load.
      });
  }, []);

  // Snapshot of `order` from the moment the current drag began -- used to
  // roll the board back exactly if the PATCH .../:id/move call fails.
  const dragStartOrderRef = useRef<Record<PriorityTaskQuadrant, string[]> | null>(null);

  // Story 3.4 -- live sync. Mirrored into a ref so the socket handler
  // (subscribed once, below) always reads the current value rather than
  // whatever `activeId` was when the effect first ran.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Re-fetches the board wholesale rather than patching one task in place --
  // a flow-changed event doesn't say what changed, only that something did,
  // and a full board is cheap enough to just re-pull. Skipped while a drag is
  // in flight so a delegate/accept landing from someone else never yanks the
  // card out from under an in-progress reorder.
  async function refreshFromServer() {
    if (activeIdRef.current) return;
    try {
      const [tasks, trackers] = await Promise.all([listPriorityTasks(), listPriorityTaskDelegationTrackers()]);
      setTaskById(Object.fromEntries(tasks.map((task) => [task.id, task])));
      setOrder(buildOrder(tasks));
      setDelegationTrackers(trackers);
    } catch {
      // Non-fatal -- the next flow-changed event (or a manual reload) will
      // catch the board up; nothing the user did locally is lost.
    }
  }

  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleFlowChanged = () => {
      refreshFromServer();
      listIncomingPriorityTasks()
        .then((items) => setIncomingCount(items.length))
        .catch(() => {
          // Non-fatal, same as the initial load above.
        });
    };
    socket.on(PRIORITY_TASK_FLOW_CHANGED_EVENT, handleFlowChanged);
    return () => {
      socket.off(PRIORITY_TASK_FLOW_CHANGED_EVENT, handleFlowChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function findContainer(id: string): PriorityTaskQuadrant | undefined {
    if (id in order) return id as PriorityTaskQuadrant;
    return QUADRANT_ORDER.find((quadrant) => order[quadrant].includes(id));
  }

  function handleDragStart(event: DragStartEvent) {
    dragStartOrderRef.current = order;
    setActiveId(event.active.id as string);
  }

  // Live-reflows the board as you drag over a different quadrant, so the
  // drop-target indicator (Story 1.3) is just "where the card currently sits
  // in the arrays" -- no separate indicator state to keep in sync.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setOrder((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(over.id as string);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [...overItems.slice(0, newIndex), active.id as string, ...overItems.slice(newIndex)],
      };
    });
  }

  // Cross-quadrant placement already happened live in onDragOver -- this
  // finalizes same-quadrant reordering, then persists wherever the task
  // actually ended up. Dropping outside any valid target (over === null)
  // needs no action: nothing was mutated for an invalid target, so the card
  // is already back where it started (Story 1.3's "snaps back", for free).
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    const startOrder = dragStartOrderRef.current;
    dragStartOrderRef.current = null;
    // Dropped outside any droppable. onDragOver may have already reflowed the
    // board optimistically (a cross-quadrant hover mutates `order`), so restore
    // the pre-drag snapshot -- returning without it would strand the card in a
    // quadrant it was never persisted to (AC 1.3: "snaps back").
    if (!over) {
      if (startOrder) setOrder(startOrder);
      return;
    }
    if (!startOrder) return;

    const activeContainer = findContainer(active.id as string);
    if (!activeContainer) return;

    let finalOrder = order;
    const overContainer = findContainer(over.id as string);
    if (overContainer === activeContainer) {
      const items = order[activeContainer];
      const activeIndex = items.indexOf(active.id as string);
      const overIndex = items.indexOf(over.id as string);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        finalOrder = { ...order, [activeContainer]: arrayMove(items, activeIndex, overIndex) };
        setOrder(finalOrder);
      }
    }

    const finalIndex = finalOrder[activeContainer].indexOf(active.id as string);
    if (finalIndex === -1) return;

    // No-op drag (dropped back where it started) -- nothing changed, so
    // there's nothing to persist.
    const startContainer = QUADRANT_ORDER.find((quadrant) => startOrder[quadrant].includes(active.id as string));
    if (startContainer === activeContainer && startOrder[activeContainer].indexOf(active.id as string) === finalIndex) {
      return;
    }

    try {
      await movePriorityTask(active.id as string, { quadrant: activeContainer, index: finalIndex });
    } catch (err) {
      setOrder(startOrder);
      showError(
        err instanceof ApiError ? err.message : t("priorityTracker.errors.moveFailed"),
        t("priorityTracker.errors.moveFailedTitle"),
      );
    }
  }

  // ESC / programmatic cancel mid-drag: dnd-kit fires this instead of
  // onDragEnd. onDragOver may have already reflowed the board across quadrants,
  // so restore the pre-drag snapshot and clear drag state -- otherwise the
  // optimistic move stays on screen but is never persisted.
  function handleDragCancel() {
    const startOrder = dragStartOrderRef.current;
    dragStartOrderRef.current = null;
    setActiveId(null);
    if (startOrder) setOrder(startOrder);
  }

  function handleTaskCreated(task: PriorityTaskResponse) {
    setTaskById((current) => ({ ...current, [task.id]: task }));
    setOrder((current) => ({ ...current, [task.quadrant]: [...current[task.quadrant], task.id] }));
    showToast({
      message: t("priorityTracker.toast.created", {
        quadrant: t(`priorityTracker.quadrants.${task.quadrant}.label`),
      }),
    });
  }

  function handleTaskSaved(task: PriorityTaskResponse) {
    setTaskById((current) => ({ ...current, [task.id]: task }));
  }

  // Story 1.8 -- an accepted task transfers to me and lands on my board in
  // the quadrant I chose; append it (owned) exactly like a freshly-created one.
  function handleTaskAccepted(task: PriorityTaskResponse) {
    setTaskById((current) => ({ ...current, [task.id]: task }));
    setOrder((current) => ({ ...current, [task.quadrant]: [...current[task.quadrant], task.id] }));
    showToast({
      message: t("priorityTracker.toast.accepted", {
        quadrant: t(`priorityTracker.quadrants.${task.quadrant}.label`),
      }),
    });
  }

  // Story 1.10 -- archiving removes the task from the active board.
  function handleTaskArchived(taskId: string) {
    setOrder((current) => {
      const quadrant = QUADRANT_ORDER.find((q) => current[q].includes(taskId));
      if (!quadrant) return current;
      return { ...current, [quadrant]: current[quadrant].filter((id) => id !== taskId) };
    });
    showToast({ message: t("priorityTracker.toast.archived") });
  }

  // Story 1.10 -- restoring returns it to its old quadrant at the bottom.
  function handleTaskRestored(task: PriorityTaskResponse) {
    setTaskById((current) => ({ ...current, [task.id]: task }));
    setOrder((current) => ({
      ...current,
      [task.quadrant]: current[task.quadrant].includes(task.id)
        ? current[task.quadrant]
        : [...current[task.quadrant], task.id],
    }));
    showToast({ message: t("priorityTracker.toast.restored") });
  }

  // Story 1.6 -- persists the delegation, then removes the task from the
  // board entirely (it no longer comes back from findAllForUser while
  // pending) and re-fetches the tracker list so the new card (with its
  // real id, needed for any future cancel/re-delegate action) shows up in
  // the DELEGATE quadrant.
  async function handleTaskDelegated(task: PriorityTaskResponse, delegateUser: UserPickerResponse) {
    try {
      await delegatePriorityTask(task.id, { userId: delegateUser.id });
      setOrder((current) => {
        const sourceQuadrant = QUADRANT_ORDER.find((quadrant) => current[quadrant].includes(task.id));
        if (!sourceQuadrant) return current;
        return { ...current, [sourceQuadrant]: current[sourceQuadrant].filter((id) => id !== task.id) };
      });
      const trackers = await listPriorityTaskDelegationTrackers();
      setDelegationTrackers(trackers);
      showToast({ message: t("priorityTracker.toast.delegated", { name: delegateUser.displayName }) });
    } catch (err) {
      showError(
        err instanceof ApiError ? err.message : "Failed to delegate this task",
        "Delegate failed",
      );
    }
  }

  const activeTask = activeId ? taskById[activeId] : null;
  // Read the dragged card's quadrant out of `order`, not off the task object.
  // onDragOver reflows `order` live but never rewrites task.quadrant (that
  // only catches up when the PATCH response lands), so task.quadrant is stale
  // mid-drag across quadrants -- which showed the overlay the wrong rank, and
  // would now also give it the wrong accent colour.
  const activeQuadrant = activeTask
    ? (QUADRANT_ORDER.find((quadrant) => order[quadrant].includes(activeTask.id)) ?? activeTask.quadrant)
    : null;
  // Offset by the tracking cards, which are rendered above the task list and
  // share its rank sequence -- otherwise dragging into a DELEGATE quadrant
  // holding 2 trackers shows "1" on the overlay and "3" once it lands.
  const activeTaskRank =
    activeQuadrant && activeTask
      ? (activeQuadrant === PriorityTaskQuadrant.Delegate ? delegationTrackers.length : 0) +
        order[activeQuadrant].indexOf(activeTask.id) +
        1
      : 1;

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-shrink-0 items-center justify-between">
        <div className="flex flex-col">
          <h1 className="mx-0 mt-0 mb-0.5 text-[26px] font-bold text-[var(--color-text)]">
            {t("priorityTracker.title")}
          </h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("priorityTracker.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="relative cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-crm-text transition-colors duration-150 hover:bg-[var(--color-bg)]"
            onClick={() => setIsIncomingOpen(true)}
          >
            {t("priorityTracker.incoming.button")}
            {incomingCount > 0 && (
              <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-crm-primary px-1.5 py-[1px] text-[11px] font-bold text-white">
                {incomingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-crm-text transition-colors duration-150 hover:bg-[var(--color-bg)]"
            onClick={() => setIsArchiveOpen(true)}
          >
            {t("priorityTracker.archive.button")}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg border-0 bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-crm-primary-hover"
            onClick={() => setCreateDialogQuadrant(DEFAULT_QUADRANT)}
          >
            + {t("priorityTracker.newTaskButton")}
          </button>
        </div>
      </div>

      {/* 2-column grid that grows with content -- the whole page scrolls
          (main is overflow-y-auto), never each quadrant on its own. Grid's
          default row-stretch makes both quadrants in a row equal height, so
          a full Do sizes its Decide neighbour to match. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Story 2.2 -- column axis labels. The pl offset matches the row-axis
            gutter below so each label centres over its own column. */}
        <div className="mb-1.5 hidden gap-4 pl-[26px] md:flex">
          <span className={`flex-1 text-center ${AXIS_LABEL_CLASS}`}>{t("priorityTracker.axes.urgent")}</span>
          <span className={`flex-1 text-center ${AXIS_LABEL_CLASS}`}>{t("priorityTracker.axes.notUrgent")}</span>
        </div>

        <div className="flex">
          {/* Row axis labels, rotated to read bottom-to-top beside their row. */}
          <div className="hidden w-[26px] flex-shrink-0 flex-col gap-4 md:flex">
            <span className={`flex flex-1 items-center justify-center [writing-mode:vertical-rl] rotate-180 ${AXIS_LABEL_CLASS}`}>
              {t("priorityTracker.axes.important")}
            </span>
            <span className={`flex flex-1 items-center justify-center [writing-mode:vertical-rl] rotate-180 ${AXIS_LABEL_CLASS}`}>
              {t("priorityTracker.axes.notImportant")}
            </span>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            {QUADRANTS.map((config) => (
              <QuadrantPanel
                key={config.id}
                config={config}
                taskIds={order[config.id]}
                taskById={taskById}
                trackers={config.id === PriorityTaskQuadrant.Delegate ? delegationTrackers : []}
                onAddClick={setCreateDialogQuadrant}
                onOpenTask={setSelectedTaskId}
              />
            ))}
          </div>
        </div>

        {/* Story 2.3 -- the overlay renders the full card (pills, progress
            bar and all), accented to whichever quadrant it's currently over,
            not a stripped-down placeholder. */}
        <DragOverlay>
          {activeTask && activeQuadrant ? (
            <TaskCard task={activeTask} rank={activeTaskRank} accentClass={QUADRANT_STYLE[activeQuadrant].accentClass} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {createDialogQuadrant && (
        <CreateTaskDialog
          defaultQuadrant={createDialogQuadrant}
          onClose={() => setCreateDialogQuadrant(null)}
          onCreated={handleTaskCreated}
        />
      )}

      {selectedTaskId && (
        <TaskDetailDialog
          taskId={selectedTaskId}
          currentUserId={currentUserId}
          onClose={() => setSelectedTaskId(null)}
          onSaved={handleTaskSaved}
          onDelegated={handleTaskDelegated}
          onArchived={handleTaskArchived}
        />
      )}

      {isIncomingOpen && (
        <IncomingPanelDialog
          onClose={() => setIsIncomingOpen(false)}
          onAccepted={handleTaskAccepted}
          onCountChange={setIncomingCount}
          currentUserId={currentUserId}
        />
      )}

      {isArchiveOpen && (
        <ArchivePanelDialog onClose={() => setIsArchiveOpen(false)} onRestored={handleTaskRestored} />
      )}
    </div>
  );
}
