"use client";

import { useRef, useState } from "react";
import { type FunnelLead } from "@/lib/data/funnel";

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
}: {
  lead: FunnelLead;
  accent: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
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
  onMove: (leadId: string, toStage: string) => void;
  columns: FunnelColumn[];
}

export function FunnelBoard({ leads, onMove, columns }: FunnelBoardProps) {
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

  function handleDragOver(e: React.DragEvent, stage: string) {
    e.preventDefault();
    setDragOverStage(stage);
  }

  function handleDrop(stage: string) {
    if (dragIdRef.current) {
      onMove(dragIdRef.current, stage);
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
            leads={leads.filter((l) => l.stage === column.name)}
            isOver={dragOverStage === column.name}
            draggingId={draggingId}
            onDragOver={(e) => handleDragOver(e, column.name)}
            onDragLeave={() => {
              if (dragOverStage === column.name) setDragOverStage(null);
            }}
            onDrop={() => handleDrop(column.name)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        );
      })}
    </div>
  );
}
