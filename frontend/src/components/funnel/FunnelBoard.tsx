"use client";

import { useRef, useState } from "react";
import { type FunnelLead } from "@/lib/data/funnel";
import { ActivityIcon } from "@/components/ui/icons";

export interface FunnelColumn {
  id: string;
  name: string;
  // Only meaningful for Sub Stage columns -- lets AddDealDialog derive which
  // Main Stage a deal belongs to from the Sub Stage the user picks, without a
  // separate page-level "current main stage" prop that wouldn't make sense on
  // the tenant-wide Funnel overview page.
  mainStageId?: string;
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

function colorForIndex(index: number): { accent: string; bg: string } {
  return COLUMN_PALETTE[index % COLUMN_PALETTE.length] ?? DEFAULT_COLUMN_COLOR;
}

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
  onDragStart,
  onDragEnd,
  onShowHistory,
}: {
  lead: FunnelLead;
  accent: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onShowHistory?: (dealId: string) => void;
}) {
  return (
    <div
      className={`funnel-card${isDragging ? " funnel-card-dragging" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: accent }}
    >
      <div className="funnel-card-header">
        <span className="funnel-card-name">{lead.name}</span>
        <span
          className="funnel-card-avatar"
          title={lead.assignee}
          style={{ background: accent }}
        >
          {initials(lead.assignee)}
        </span>
      </div>
      <div className="funnel-card-company">{lead.company}</div>
      <div className="funnel-card-footer">
        <span className="funnel-card-value">{fmt(lead.value)}</span>
        <span className="funnel-card-date">{lead.date}</span>
        {onShowHistory && (
          <button
            type="button"
            className="funnel-card-history-btn"
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
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onShowHistory,
}: {
  columnName: string;
  accent: string;
  bg: string;
  leads: FunnelLead[];
  isOver: boolean;
  draggingId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onShowHistory?: (dealId: string) => void;
}) {
  const total = leads.reduce((s, l) => s + l.value, 0);

  return (
    <div
      className={`funnel-column${isOver ? " funnel-column-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      {/* Column header */}
      <div className="funnel-column-header">
        <div className="funnel-column-title-row">
          <span className="funnel-column-dot" style={{ background: accent }} />
          <span className="funnel-column-title">{columnName}</span>
          <span
            className="funnel-column-count"
            style={{ background: bg, color: accent }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className={`funnel-column-body${isOver ? " funnel-column-body-over" : ""}`}>
        {leads.map((lead) => (
          <DealCard
            key={lead.id}
            lead={lead}
            accent={accent}
            isDragging={lead.id === draggingId}
            onDragStart={() => onDragStart(lead.id)}
            onDragEnd={onDragEnd}
            onShowHistory={onShowHistory}
          />
        ))}
        {leads.length === 0 && (
          <div className={`funnel-column-empty${isOver ? " funnel-column-empty-over" : ""}`}>
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
  onShowHistory?: (dealId: string) => void;
}

export function FunnelBoard({ leads, onMove, columns, onShowHistory }: FunnelBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

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
    e.preventDefault();
    setDragOverStage(stageId);
  }

  function handleDrop(stageId: string) {
    if (dragIdRef.current) {
      onMove(dragIdRef.current, stageId);
    }
    dragIdRef.current = null;
    setDraggingId(null);
    setDragOverStage(null);
  }

  return (
    <div className="funnel-board" style={{ minHeight: "calc(100vh - 260px)" }}>
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
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={() => {
              if (dragOverStage === column.id) setDragOverStage(null);
            }}
            onDrop={() => handleDrop(column.id)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onShowHistory={onShowHistory}
          />
        );
      })}
    </div>
  );
}
