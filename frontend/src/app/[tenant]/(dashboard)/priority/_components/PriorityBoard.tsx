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
  type PriorityTaskDelegationTrackerResponse,
  type PriorityTaskResponse,
  type UserPickerResponse,
} from "@orelia/common";
import { t } from "@/lib/i18n";
import { PlusIcon } from "@/components/ui/icons";
import {
  delegatePriorityTask,
  listIncomingPriorityTasks,
  listPriorityTaskDelegationTrackers,
  movePriorityTask,
} from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { useAlert } from "@/components/providers/DialogProvider";
import { ArchivePanelDialog } from "./ArchivePanelDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { IncomingPanelDialog } from "./IncomingPanelDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { DEFAULT_QUADRANT, QUADRANT_ORDER } from "./types";

// Story 1.1 (View/Navigate) + 1.2 (Create) + 1.3 (Drag-and-drop reorder) --
// backed by the real /priority-tasks API throughout. Reordering/quadrant
// moves apply optimistically (the board reflows immediately as you drag),
// then persist via PATCH .../:id/move; a failed save rolls the board back
// to exactly how it looked before the drag and surfaces an error.

interface QuadrantConfig {
  id: PriorityTaskQuadrant;
  watermark: string;
  panelClass: string;
  watermarkClass: string;
}

// Pastel washes are distinct per quadrant and deliberately don't use
// crm-primary -- that red is reserved for primary actions/active nav/badges/
// focus rings, never a large quadrant surface fill (see CLAUDE.md's Design
// System rules).
const QUADRANT_STYLE: Record<PriorityTaskQuadrant, Omit<QuadrantConfig, "id">> = {
  [PriorityTaskQuadrant.Do]: {
    watermark: "DO",
    panelClass: "bg-orange-50 border-orange-100",
    watermarkClass: "text-orange-200/70",
  },
  [PriorityTaskQuadrant.Decide]: {
    watermark: "DECIDE",
    panelClass: "bg-sky-50 border-sky-100",
    watermarkClass: "text-sky-200/70",
  },
  [PriorityTaskQuadrant.Delegate]: {
    watermark: "DELEGATE",
    panelClass: "bg-amber-50 border-amber-100",
    watermarkClass: "text-amber-200/70",
  },
  [PriorityTaskQuadrant.Delete]: {
    watermark: "DELETE",
    panelClass: "bg-slate-100 border-slate-200",
    watermarkClass: "text-slate-300/70",
  },
};
const QUADRANTS: QuadrantConfig[] = QUADRANT_ORDER.map((id) => ({ id, ...QUADRANT_STYLE[id] }));

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

function OwnershipBadge({ ownership }: { ownership: PriorityTaskResponse["ownership"] }) {
  const isOwned = ownership === "owned";
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-[3px] text-[11px] font-semibold ${
        isOwned ? "bg-[var(--color-bg)] text-[var(--color-text-muted)]" : "bg-crm-primary-tint text-crm-primary"
      }`}
    >
      {isOwned ? t("priorityTracker.badge.owned") : t("priorityTracker.badge.received")}
    </span>
  );
}

function DelegatedBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex flex-shrink-0 items-center rounded-full bg-crm-primary-tint px-2 py-[3px] text-[11px] font-semibold text-crm-primary">
      {t("priorityTracker.badge.delegatedTo", { name })}
    </span>
  );
}

// A task with a pending delegation is removed from the board entirely
// (see findAllForUser's delegatedToUserId filter) -- its delegator-side
// representation is a TrackerCard instead, never this component, so
// TaskCard/SortableTaskCard never need to know about delegation.
function TaskCard({ task, rank }: { task: PriorityTaskResponse; rank: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-[11.5px] font-semibold text-[var(--color-text-muted)]">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-crm-text">{task.title}</span>
      <OwnershipBadge ownership={task.ownership} />
    </div>
  );
}

function SortableTaskCard({
  task,
  rank,
  onOpen,
}: {
  task: PriorityTaskResponse;
  rank: number;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative z-10 cursor-grab touch-none active:cursor-grabbing"
      onClick={() => onOpen(task.id)}
    >
      <TaskCard task={task} rank={rank} />
    </div>
  );
}

// Story 1.6 -- the delegator's own read-only breadcrumb for something
// they've handed off. Deliberately not draggable/sortable (it isn't a real
// task placement, just a live-joined reference) and not clickable yet --
// accepting/re-delegating/cancelling are Story 1.8 territory.
function TrackerCard({ tracker }: { tracker: PriorityTaskDelegationTrackerResponse }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--color-border)] bg-white/60 p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-crm-text">{tracker.taskTitle}</span>
      <DelegatedBadge name={tracker.delegatedToName} />
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

  return (
    <div
      className={`relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border p-4 ${config.panelClass}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-2 bottom-0 z-0 text-[64px] leading-none font-black tracking-tight select-none ${config.watermarkClass}`}
      >
        {config.watermark}
      </span>

      <div className="relative z-10 mb-3 flex flex-shrink-0 items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-crm-text">{label}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(`priorityTracker.quadrants.${config.id}.sublabel`)}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("priorityTracker.addToQuadrantAriaLabel", { quadrant: label })}
          className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-white/70 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-white hover:text-crm-primary"
          onClick={() => onAddClick(config.id)}
        >
          <PlusIcon size={14} />
        </button>
      </div>

      <div ref={setNodeRef} className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {trackers.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {trackers.map((tracker) => (
              <TrackerCard key={tracker.id} tracker={tracker} />
            ))}
          </div>
        )}
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 && trackers.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 text-center">
              <p className="text-[13px] font-medium text-crm-text">{t("priorityTracker.emptyState.title")}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{t("priorityTracker.emptyState.message")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {tasks.map((task, index) => (
                <SortableTaskCard key={task.id} task={task} rank={index + 1} onOpen={onOpenTask} />
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
}

export function PriorityBoard({ initialTasks, initialDelegationTrackers }: PriorityBoardProps) {
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
  }

  function handleTaskSaved(task: PriorityTaskResponse) {
    setTaskById((current) => ({ ...current, [task.id]: task }));
  }

  // Story 1.8 -- an accepted task transfers to me and lands on my board in
  // the quadrant I chose; append it (owned) exactly like a freshly-created one.
  function handleTaskAccepted(task: PriorityTaskResponse) {
    setTaskById((current) => ({ ...current, [task.id]: task }));
    setOrder((current) => ({ ...current, [task.quadrant]: [...current[task.quadrant], task.id] }));
  }

  // Story 1.10 -- archiving removes the task from the active board.
  function handleTaskArchived(taskId: string) {
    setOrder((current) => {
      const quadrant = QUADRANT_ORDER.find((q) => current[q].includes(taskId));
      if (!quadrant) return current;
      return { ...current, [quadrant]: current[quadrant].filter((id) => id !== taskId) };
    });
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
    } catch (err) {
      showError(
        err instanceof ApiError ? err.message : "Failed to delegate this task",
        "Delegate failed",
      );
    }
  }

  const activeTask = activeId ? taskById[activeId] : null;
  const activeTaskRank = activeTask ? order[activeTask.quadrant].indexOf(activeTask.id) + 1 : 1;

  return (
    <div className="flex h-full flex-col">
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

      {/* Equal-size 2x2 grid filling all remaining height -- each quadrant is
          exactly one grid cell, together covering the full board area with
          no leftover space, instead of sizing to its own content. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-4 md:grid-cols-2 md:grid-rows-2">
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

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} rank={activeTaskRank} /> : null}</DragOverlay>
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
        />
      )}

      {isArchiveOpen && (
        <ArchivePanelDialog onClose={() => setIsArchiveOpen(false)} onRestored={handleTaskRestored} />
      )}
    </div>
  );
}
