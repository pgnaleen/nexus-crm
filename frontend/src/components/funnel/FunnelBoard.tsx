"use client";

import { useEffect, useRef, useState } from "react";
import { type FunnelLead } from "@/lib/data/funnel";
import { DealStatus } from "@orelia/common";
import { ActivityIcon, BuildingIcon, UserIcon } from "@/components/ui/icons";
import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRIES } from "@/lib/countries";

// Same SVG-flag approach as CountrySelect.tsx -- Windows renders no flag
// emojis at all (Segoe UI Emoji excludes them), so this codebase always uses
// country-flag-icons SVGs instead of emoji flags. dealCountry stores the
// plain country name, so this maps back to the ISO code the Flags lookup
// needs.
const COUNTRY_CODE_BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c.code]));

const STATUS_BADGE: Record<DealStatus, { label: string; bg: string; color: string }> = {
  [DealStatus.Open]: { label: "Open", bg: "#e0e7ff", color: "#4338ca" },
  [DealStatus.Won]: { label: "Won", bg: "#e6f7ee", color: "#1a9c5f" },
  [DealStatus.Lost]: { label: "Lost", bg: "#fdf0ee", color: "#c0392b" },
  [DealStatus.OnHold]: { label: "On Hold", bg: "#fef3c7", color: "#b8860b" },
};

export interface FunnelColumn {
  id: string;
  name: string;
  // Only meaningful for Sub Stage columns -- lets AddDealDialog derive which
  // Main Stage a deal belongs to from the Sub Stage the user picks, without a
  // separate page-level "current main stage" prop that wouldn't make sense on
  // the tenant-wide Funnel overview page.
  mainStageId?: string;
  // Only meaningful for Main Stage columns (the Funnel overview board) --
  // its sequence in the funnel, used to detect when a drag-and-drop move
  // skips over one or more stages in between.
  position?: number;
}

/* ── Column colours ─────────────────────────────────────────── */
// Columns are driven by real dynamic data (Main Stage or Sub Stage names,
// depending on which board this is), so colours can't be keyed by name --
// there's no fixed set of names to hardcode. Assign by position instead.
const COLUMN_PALETTE: { accent: string; bg: string }[] = [
  { accent: "#2f6feb", bg: "#dbeafe" },
  { accent: "#7c3aed", bg: "#ede9fe" },
  { accent: "#6366f1", bg: "#e0e7ff" },
  { accent: "#0891b2", bg: "#cffafe" },
  { accent: "#ec4899", bg: "#fce7f3" },
  { accent: "#d946ef", bg: "#fae8ff" },
  { accent: "#d97706", bg: "#fef3c7" },
  { accent: "#10b981", bg: "#d1fae5" },
  { accent: "#ef4444", bg: "#fee2e2" },
  { accent: "#0ea5e9", bg: "#e0f2fe" },
];

const DEFAULT_COLUMN_COLOR = { accent: "#64748b", bg: "#f1f5f9" };

// Auto-scroll while dragging a card near the board's left/right edge -- with
// enough Main Stage columns to overflow, there was previously no way to drag
// a card from the first column to an off-screen one without dropping,
// scrolling manually, and re-dragging. EDGE_ZONE_PX is how close to the edge
// (in pixels) triggers scrolling; speed ramps up linearly from 0 at the edge
// of the zone to MAX_SCROLL_SPEED_PX right at (or past) the board's boundary.
const EDGE_ZONE_PX = 70;
const MAX_SCROLL_SPEED_PX = 18;

// 0 at the outer edge of the zone, ramping up to 1 at/past the boundary --
// distanceFromEdge is allowed to go negative (cursor dragged past the
// board's actual edge, e.g. over the sidebar) without overshooting speed.
function edgeScrollSpeed(distanceFromEdge: number): number {
  const clamped = Math.max(0, Math.min(EDGE_ZONE_PX, distanceFromEdge));
  return MAX_SCROLL_SPEED_PX * (1 - clamped / EDGE_ZONE_PX);
}

function colorForIndex(index: number): { accent: string; bg: string } {
  return COLUMN_PALETTE[index % COLUMN_PALETTE.length] ?? DEFAULT_COLUMN_COLOR;
}

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(v: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ── Deal card ──────────────────────────────────────────────── */
function DealCard({
  lead,
  accent,
  isDragging,
  canDrag,
  onDragStart,
  onDragEnd,
  onShowHistory,
  onViewDeal,
}: {
  lead: FunnelLead;
  accent: string;
  isDragging: boolean;
  canDrag: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onShowHistory?: (dealId: string) => void;
  onViewDeal?: (dealId: string) => void;
}) {
  const countryCode = lead.country ? COUNTRY_CODE_BY_NAME.get(lead.country) : undefined;
  const Flag = countryCode ? Flags[countryCode as keyof typeof Flags] : undefined;

  return (
    <div
      className={`select-none rounded-[10px] border-l-[3px] bg-white px-3 pb-2.5 pt-3 shadow-[0_1px_3px_rgba(16,24,40,0.07)] transition-[box-shadow,opacity,transform] duration-150 hover:shadow-[0_4px_12px_rgba(16,24,40,0.12)] hover:-translate-y-px${
        canDrag ? " cursor-grab active:cursor-grabbing" : ""
      }${isDragging ? " opacity-40 scale-[0.97]" : ""}`}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={() => onViewDeal?.(lead.id)}
      style={{ borderLeftColor: accent }}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13.5px] font-bold leading-[1.3] text-[var(--color-text)]" title={lead.name}>
            {lead.name}
          </span>
          {lead.code && (
            <span className="text-[10px] font-medium tabular-nums text-[var(--color-text-muted)]">
              {lead.code}
            </span>
          )}
        </div>
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[9px] font-extrabold tracking-[0.02em] text-white"
          title={lead.assignee}
          style={{ background: accent }}
        >
          {initials(lead.assignee)}
        </span>
      </div>
      {lead.status && (
        <div className="mb-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: STATUS_BADGE[lead.status].bg, color: STATUS_BADGE[lead.status].color }}
          >
            {STATUS_BADGE[lead.status].label}
          </span>
        </div>
      )}
      <div className="mb-2.5 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {lead.company ? (
            <>
              <span className="flex-shrink-0 text-[var(--color-text-muted)]">
                {lead.customerKind === "contact" ? <UserIcon size={12} /> : <BuildingIcon size={12} />}
              </span>
              <span className="truncate text-[12px] font-medium text-[var(--color-text)]" title={lead.company}>
                {lead.company}
              </span>
            </>
          ) : (
            <span className="truncate text-[12px] italic text-[var(--color-text-muted)]">No customer set</span>
          )}
        </div>
        {lead.country && (
          <div className="flex items-center gap-1.5 overflow-hidden">
            {Flag && <Flag aria-hidden="true" className="w-4 flex-shrink-0 rounded-[2px]" />}
            <span className="truncate text-[11px] text-[var(--color-text-muted)]" title={lead.country}>
              {lead.country}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2">
        <span className="text-[13.5px] font-bold tabular-nums text-[var(--color-text)]">
          {fmt(lead.value, lead.currency ?? "USD")}
        </span>
        <span className="text-[10.5px] text-[var(--color-text-muted)]">{lead.date}</span>
        {onShowHistory && (
          <button
            type="button"
            className="flex h-[22px] w-[22px] flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#f1f5f9] hover:text-[var(--color-brand)]"
            aria-label="View stage history"
            title="View stage history"
            onClick={(e) => {
              e.stopPropagation();
              onShowHistory(lead.id);
            }}
          >
            <ActivityIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Kanban column ──────────────────────────────────────────── */
function KanbanColumn({
  columnName,
  accent,
  bg,
  leads,
  isOver,
  draggingId,
  canDrag,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onShowHistory,
  onViewDeal,
}: {
  columnName: string;
  accent: string;
  bg: string;
  leads: FunnelLead[];
  isOver: boolean;
  draggingId: string | null;
  canDrag: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onShowHistory?: (dealId: string) => void;
  onViewDeal?: (dealId: string) => void;
}) {
  const total = leads.reduce((s, l) => s + l.value, 0);

  return (
    <div
      className={`flex min-w-[260px] flex-1 flex-col border-r border-[var(--color-border)] last:border-r-0 transition-colors duration-150 ${
        isOver ? "bg-[rgba(47,111,235,0.03)]" : "bg-white"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      {/* Column header */}
      <div className="sticky top-0 z-[1] border-b border-[var(--color-border)] bg-[#f1f5f9] px-[14px] pb-3 pt-[14px]">
        <div className="flex items-center gap-[7px]">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: accent }} />
          <span className="flex-1 whitespace-nowrap text-[13px] font-semibold text-[var(--color-text)]">
            {columnName}
          </span>
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
            style={{ background: bg, color: accent }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        className={`flex flex-1 flex-col gap-2 px-2 py-2.5 transition-colors duration-150${
          isOver ? " bg-[rgba(47,111,235,0.04)]" : ""
        }`}
      >
        {leads.map((lead) => (
          <DealCard
            key={lead.id}
            lead={lead}
            accent={accent}
            isDragging={lead.id === draggingId}
            canDrag={canDrag}
            onDragStart={() => onDragStart(lead.id)}
            onDragEnd={onDragEnd}
            onShowHistory={onShowHistory}
            onViewDeal={onViewDeal}
          />
        ))}
        {leads.length === 0 && (
          <div
            className={`flex min-h-16 items-center justify-center rounded-[10px] border-2 border-dashed text-xs transition-colors duration-150 select-none ${
              isOver
                ? "border-[var(--color-brand)] bg-[rgba(47,111,235,0.04)] text-[var(--color-brand)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main board ─────────────────────────────────────────────── */
interface FunnelBoardProps {
  leads: FunnelLead[];
  // toStageId is the id of the column the card was dropped on -- callers
  // persist moves by id, not by the display name shown in the column header.
  onMove: (leadId: string, toStageId: string) => void;
  columns: FunnelColumn[];
  // Gates drag-and-drop entirely (DEALS_UPDATE) -- defaults to true so every
  // other caller keeps today's behavior; the Funnel board is the only one
  // that actually needs to turn it off for a view-only user.
  canDrag?: boolean;
  onShowHistory?: (dealId: string) => void;
  onViewDeal?: (dealId: string) => void;
}

export function FunnelBoard({
  leads,
  onMove,
  columns,
  canDrag = true,
  onShowHistory,
  onViewDeal,
}: FunnelBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // -1 = scrolling left, 0 = not scrolling, 1 = scrolling right. A ref, not
  // state -- updated on every dragover (which can fire many times a second)
  // and read every animation frame, neither of which should trigger re-renders.
  const scrollDirectionRef = useRef(0);
  const scrollSpeedRef = useRef(0);

  function handleDragStart(id: string) {
    dragIdRef.current = id;
    setDraggingId(id);
  }

  function handleDragEnd() {
    dragIdRef.current = null;
    setDraggingId(null);
    setDragOverStage(null);
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    if (!canDrag) return;
    e.preventDefault();
    setDragOverStage(stageId);
  }

  function handleDrop(stageId: string) {
    if (canDrag && dragIdRef.current) {
      onMove(dragIdRef.current, stageId);
    }
    dragIdRef.current = null;
    setDraggingId(null);
    setDragOverStage(null);
  }

  // dragover bubbles up from whichever column/card is under the cursor, so
  // this one handler on the scroll container (not each column) is enough to
  // track how close the cursor is to the left/right edge for auto-scrolling.
  function handleContainerDragOver(e: React.DragEvent) {
    if (!canDrag) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const distanceFromLeft = e.clientX - rect.left;
    const distanceFromRight = rect.right - e.clientX;

    if (distanceFromLeft < EDGE_ZONE_PX) {
      scrollDirectionRef.current = -1;
      scrollSpeedRef.current = edgeScrollSpeed(distanceFromLeft);
    } else if (distanceFromRight < EDGE_ZONE_PX) {
      scrollDirectionRef.current = 1;
      scrollSpeedRef.current = edgeScrollSpeed(distanceFromRight);
    } else {
      scrollDirectionRef.current = 0;
    }
  }

  // Runs a rAF loop only while a card is actively being dragged (draggingId
  // set) -- decoupled from dragover's own firing rate (which pauses while the
  // cursor is stationary in some browsers) so the scroll stays smooth for as
  // long as the cursor sits in the edge zone, not just while it's moving.
  useEffect(() => {
    if (!draggingId) {
      scrollDirectionRef.current = 0;
      return;
    }
    let frameId: number;
    function step() {
      const container = scrollContainerRef.current;
      if (container && scrollDirectionRef.current !== 0) {
        container.scrollLeft += scrollDirectionRef.current * scrollSpeedRef.current;
      }
      frameId = requestAnimationFrame(step);
    }
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [draggingId]);

  return (
    <div
      ref={scrollContainerRef}
      onDragOver={handleContainerDragOver}
      className="flex min-h-[calc(100vh-260px)] flex-1 items-stretch rounded-b-[14px] border border-t-0 border-[var(--color-border)] bg-white overflow-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--color-border)]">
      {columns.map((column, index) => {
        const { accent, bg } = colorForIndex(index);
        return (
          <KanbanColumn
            key={column.id}
            columnName={column.name}
            accent={accent}
            bg={bg}
            leads={leads.filter((l) => l.stage === column.id)}
            isOver={dragOverStage === column.id}
            draggingId={draggingId}
            canDrag={canDrag}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={() => {
              if (dragOverStage === column.id) setDragOverStage(null);
            }}
            onDrop={() => handleDrop(column.id)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onShowHistory={onShowHistory}
            onViewDeal={onViewDeal}
          />
        );
      })}
    </div>
  );
}
