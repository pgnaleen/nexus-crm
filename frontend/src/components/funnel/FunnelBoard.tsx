"use client";

import { useRef, useState } from "react";
import { type FunnelLead } from "@/lib/data/funnel";
import type { MainStageResponse } from "@orelia/common";

/* ── Stage colours ─────────────────────────────────────────── */
const STAGE_CONFIG: Record<string, { accent: string; bg: string }> = {
  "New Lead":                { accent: "#2f6feb", bg: "#dbeafe" },
  "Qualified":               { accent: "#7c3aed", bg: "#ede9fe" },
  "Discovery":               { accent: "#6366f1", bg: "#e0e7ff" },
  "Proposal Sent":           { accent: "#0891b2", bg: "#cffafe" },
  "Negotiation":             { accent: "#ec4899", bg: "#fce7f3" },
  "Evaluation":              { accent: "#d946ef", bg: "#fae8ff" },
  "Decision Pending":        { accent: "#d97706", bg: "#fef3c7" },
  "Won":                     { accent: "#10b981", bg: "#d1fae5" },
  "Closed Lost":             { accent: "#ef4444", bg: "#fee2e2" },
  "Purchase Order Received": { accent: "#8b5cf6", bg: "#ede9fe" },
  "Contract Signed":         { accent: "#0ea5e9", bg: "#e0f2fe" },
  "Project Kickoff":         { accent: "#f59e0b", bg: "#fef3c7" },
  "Delivery":                { accent: "#e11d48", bg: "#ffe4e6" },
  "Completed":               { accent: "#059669", bg: "#d1fae5" },
};

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
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lead: FunnelLead;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const cfg = STAGE_CONFIG[lead.stage];
  return (
    <div
      className={`funnel-card${isDragging ? " funnel-card-dragging" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: cfg.accent }}
    >
      <div className="funnel-card-header">
        <span className="funnel-card-name">{lead.name}</span>
        <span
          className="funnel-card-avatar"
          title={lead.assignee}
          style={{ background: cfg.accent }}
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
  stageName,
  leads,
  isOver,
  draggingId,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
}: {
  stageName: string;
  leads: FunnelLead[];
  isOver: boolean;
  draggingId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const cfg = STAGE_CONFIG[stageName] ?? { accent: "#64748b", bg: "#f1f5f9" };
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
          <span className="funnel-column-dot" style={{ background: cfg.accent }} />
          <span className="funnel-column-title">{stageName}</span>
          <span
            className="funnel-column-count"
            style={{ background: cfg.bg, color: cfg.accent }}
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
  mainStages: MainStageResponse[];
}

export function FunnelBoard({ leads, onMove, mainStages }: FunnelBoardProps) {
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
      {mainStages.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stageName={stage.name}
          leads={leads.filter((l) => l.stage === stage.name)}
          isOver={dragOverStage === stage.name}
          draggingId={draggingId}
          onDragOver={(e) => handleDragOver(e, stage.name)}
          onDragLeave={() => {
            if (dragOverStage === stage.name) setDragOverStage(null);
          }}
          onDrop={() => handleDrop(stage.name)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}
