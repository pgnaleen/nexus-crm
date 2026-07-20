"use client";

import { useEffect, useRef, useState } from "react";
import { type FunnelLead } from "@/lib/data/funnel";
import type {
  CompanyPickerResponse,
  ContactPickerResponse,
  DealResponse,
  DealSourceResponse,
  DepartmentResponse,
  EmployeePickerResponse,
  IndustryResponse,
  RelationshipTypeResponse,
} from "@orelia/common";
import { FunnelBoard, type FunnelColumn } from "@/components/funnel/FunnelBoard";
import { AddDealDialog } from "@/components/funnel/AddDealDialog";
import { DealStageHistoryDialog } from "@/components/funnel/DealStageHistoryDialog";
import { moveDeal } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/providers/ToastProvider";
import { useAlert } from "@/components/providers/DialogProvider";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

/* ── Per-source accent colours ─────────────────────────────── */
const SOURCE_CONFIG: Record<string, { accent: string; bg: string }> = {
  all:          { accent: "#475569", bg: "#f1f5f9" },
  customers:    { accent: "#2f6feb", bg: "#dbeafe" },
  ceo:          { accent: "#7c3aed", bg: "#ede9fe" },
  partners:     { accent: "#059669", bg: "#d1fae5" },
  direct:       { accent: "#d97706", bg: "#fef3c7" },
  referral:     { accent: "#e11d48", bg: "#ffe4e6" },
  social_media: { accent: "#0ea5e9", bg: "#e0f2fe" },
  events:       { accent: "#d946ef", bg: "#fae8ff" },
  inbound:      { accent: "#14b8a6", bg: "#ccfbf1" },
};

// How long a stage move stays undoable before it's persisted to the backend.
const UNDO_GRACE_PERIOD_MS = 30000;

type StageField = "mainStageName" | "currentStageName";
type StageIdField = "mainStageId" | "currentStageId";

const STAGE_ID_FIELD: Record<StageField, StageIdField> = {
  mainStageName: "mainStageId",
  currentStageName: "currentStageId",
};

/* ── Convert a real Deal into the board's display shape ──────── */
// stageIdField selects which deal field drives the column a card lands in:
//   "mainStageId"    → funnel overview board (columns = Main Stages)
//   "currentStageId" → per-main-stage board  (columns = Sub Stages)
function dealToFunnelLead(deal: DealResponse, stageIdField: StageIdField): FunnelLead {
  return {
    id: deal.id,
    name: deal.name,
    company: deal.companyName ?? "",
    value: deal.estimatedValue ?? 0,
    stage: deal[stageIdField] ?? "",
    date: deal.expectedCloseDate ?? "",
    assignee: deal.ownerName ?? "Unassigned",
  };
}

interface PendingMove {
  toastId: string;
  // Snapshot of the deal's stage fields *before* any optimistic change in
  // this pending sequence -- kept across rapid re-drags of the same card so
  // Undo always lands on the last value actually saved in the backend.
  original: Pick<DealResponse, "mainStageId" | "mainStageName" | "currentStageId" | "currentStageName">;
}

interface FunnelSourceTabsProps {
  dealSources: DealSourceResponse[];
  columns: FunnelColumn[];
  // Sub Stage options for the Add Deal dialog, when they differ from the
  // board's own `columns` (e.g. the Funnel overview groups its board by Main
  // Stage, but a deal's currentStageId must be a real Sub Stage). Defaults to
  // `columns` when the board is already Sub-Stage-shaped. Also used to
  // resolve which Sub Stage a Main-Stage-grouped board should move a deal
  // into when it's dropped on a Main Stage column (see resolveTarget below).
  stageOptions?: FunnelColumn[];
  // Which deal field to use when matching a deal card into a board column:
  //   "mainStageName"    → funnel overview (Main Stage columns, default)
  //   "currentStageName" → per-main-stage board (Sub Stage columns)
  stageField?: StageField;
  companies: CompanyPickerResponse[];
  employees: EmployeePickerResponse[];
  contacts: ContactPickerResponse[];
  departments: DepartmentResponse[];
  relationshipTypes: RelationshipTypeResponse[];
  industries: IndustryResponse[];
  initialDeals?: DealResponse[];
  title?: string;
  subtitle?: string;
  addButtonLabel?: string;
}

export function FunnelSourceTabs({
  dealSources,
  columns,
  stageOptions,
  stageField = "mainStageName",
  companies,
  employees,
  contacts,
  departments,
  relationshipTypes,
  industries,
  initialDeals = [],
  title = "Funnel",
  subtitle = "Track deals by acquisition source",
  addButtonLabel = "Add New Deal",
}: FunnelSourceTabsProps) {
  const stageIdField = STAGE_ID_FIELD[stageField];
  const dynamicSources = [
    { id: "all", name: "All" },
    ...dealSources.map((ds) => ({ id: ds.id, name: ds.name })),
  ];

  const [activeId, setActiveId] = useState(dynamicSources[0]?.id ?? "all");
  const [deals, setDeals] = useState<DealResponse[]>(initialDeals);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  const [isAddDealOpen, setAddDealOpen] = useState(false);
  const [historyDealId, setHistoryDealId] = useState<string | null>(null);

  const { showToast, dismissToast, flushToast } = useToast();
  const { showError } = useAlert();
  const pendingMovesRef = useRef<Map<string, PendingMove>>(new Map());
  const mountedRef = useRef(true);

  // On unmount (e.g. navigating to another page), any move still sitting in
  // its undo grace period would otherwise be silently lost -- flush it now
  // so it's persisted instead.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingMovesRef.current.forEach((pending) => flushToast(pending.toastId));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFilters = search !== "" || department !== "" || country !== "";

  const columnNameById = new Map(columns.map((c) => [c.id, c.name]));

  const activeDeals = activeId === "all" ? deals : deals.filter((d) => d.sourceId === activeId);
  const activeLeads = activeDeals.map((deal) => dealToFunnelLead(deal, stageIdField));
  const activeCfg = SOURCE_CONFIG[activeId] ?? { accent: "#2f6feb", bg: "#dbeafe" };

  // Dropping on a board column always needs a real Sub Stage id to persist
  // (that's what the backend + history rows track). Per-Main-Stage boards
  // already have Sub Stage columns, so the dropped column *is* the target.
  // The tenant-wide overview groups by Main Stage instead, so dropping there
  // is ambiguous as to which Sub Stage -- land in that Main Stage's first
  // Sub Stage in sequence, the same default used when creating a new deal.
  function resolveTarget(droppedColumnId: string): { subStageId: string; mainStageId?: string } | null {
    if (stageField !== "mainStageName") {
      return { subStageId: droppedColumnId };
    }
    const firstSubStage = (stageOptions ?? []).find((s) => s.mainStageId === droppedColumnId);
    if (!firstSubStage) return null;
    return { subStageId: firstSubStage.id, mainStageId: droppedColumnId };
  }

  function handleMove(dealId: string, droppedColumnId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const currentColumnId = deal[stageIdField] ?? "";
    if (currentColumnId === droppedColumnId) return; // dropped back on its own column

    const target = resolveTarget(droppedColumnId);
    if (!target) {
      showError("This stage doesn't have any sub stages configured yet.", "Can't move deal");
      return;
    }

    const existingPending = pendingMovesRef.current.get(dealId);
    if (existingPending) {
      // Re-dragging the same card before its previous move was persisted --
      // cancel that toast/timer silently (nothing was saved yet) and replace
      // it with a fresh grace period for the new target.
      dismissToast(existingPending.toastId);
    }
    const original: PendingMove["original"] = existingPending?.original ?? {
      mainStageId: deal.mainStageId,
      mainStageName: deal.mainStageName,
      currentStageId: deal.currentStageId,
      currentStageName: deal.currentStageName,
    };

    const toastId = showToast({
      message: `Deal moved to ${columnNameById.get(droppedColumnId) ?? "new stage"}`,
      actionLabel: "Undo",
      durationMs: UNDO_GRACE_PERIOD_MS,
      onAction: () => handleUndo(dealId),
      onExpire: () => void persistMove(dealId, target.subStageId),
    });

    pendingMovesRef.current.set(dealId, { toastId, original });

    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const next: DealResponse = { ...d, currentStageId: target.subStageId };
        if (target.mainStageId) {
          next.mainStageId = target.mainStageId;
          next.mainStageName = columnNameById.get(target.mainStageId) ?? d.mainStageName;
        } else {
          next.currentStageName = columnNameById.get(target.subStageId) ?? d.currentStageName;
        }
        return next;
      }),
    );
  }

  function handleUndo(dealId: string) {
    const pending = pendingMovesRef.current.get(dealId);
    if (!pending) return;
    pendingMovesRef.current.delete(dealId);
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...pending.original } : d)));
  }

  async function persistMove(dealId: string, subStageId: string) {
    const pending = pendingMovesRef.current.get(dealId);
    pendingMovesRef.current.delete(dealId);
    try {
      const updated = await moveDeal(dealId, { toStageId: subStageId });
      if (mountedRef.current) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
      }
    } catch (err) {
      if (!mountedRef.current) return;
      showError(err instanceof ApiError ? err.message : "Failed to save the stage change", "Move failed");
      if (pending) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...pending.original } : d)));
      }
    }
  }

  function handleDealCreated(deal: DealResponse) {
    setDeals((prev) => [...prev, deal]);
  }

  return (
    <div className="funnel-page">
      {/* ── Title ──────────────────────── */}
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">{title}</h1>
          <p className="funnel-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="funnel-add-btn" onClick={() => setAddDealOpen(true)}>
          {addButtonLabel}
        </button>
      </div>

      {/* ── Filters ──────────────────────── */}
      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="funnel-filters-selects">
            <CustomSelect
              label="Department"
              value={department}
              onChange={setDepartment}
              options={[
                { value: "", label: "All" },
                { value: "sales", label: "Sales" },
                { value: "marketing", label: "Marketing" },
              ]}
            />

            <CustomSelect
              label="Country"
              value={country}
              onChange={setCountry}
              options={[
                { value: "", label: "All" },
                { value: "us", label: "United States" },
                { value: "uk", label: "United Kingdom" },
                { value: "au", label: "Australia" },
              ]}
            />
          </div>
        </div>

        {hasFilters && (
          <div className="funnel-filters-right">
            <button
              type="button"
              className="funnel-clear-btn"
              onClick={() => {
                setSearch("");
                setDepartment("");
                setCountry("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="funnel-workspace">
        {/* ── Folder Tabs ──────────────────────── */}
        <div className="funnel-folder-tabs">
          {dynamicSources.map((src) => {
            const cfg = SOURCE_CONFIG[src.id] ?? { accent: "#475569", bg: "#f1f5f9" };
            const isActive = activeId === src.id;
            return (
              <button
                key={src.id}
                type="button"
                className={`funnel-folder-tab${isActive ? " funnel-folder-tab-active" : ""}`}
                style={
                  isActive
                    ? { background: cfg.accent, borderColor: cfg.accent, color: "#fff" }
                    : {}
                }
                onClick={() => setActiveId(src.id)}
              >
                {src.name}
              </button>
            );
          })}
        </div>

        {/* ── Kanban board container ──────────────────────── */}
        <div
          className="funnel-board-wrapper"
          style={{ borderTop: `3px solid ${activeCfg.accent}` }}
        >
          <FunnelBoard
            leads={activeLeads}
            onMove={handleMove}
            columns={columns}
            onShowHistory={(dealId) => setHistoryDealId(dealId)}
          />
        </div>
      </div>

      {isAddDealOpen && (
        <AddDealDialog
          dealSources={dealSources}
          columns={columns}
          stageOptions={stageOptions}
          companies={companies}
          employees={employees}
          contacts={contacts}
          departments={departments}
          relationshipTypes={relationshipTypes}
          industries={industries}
          defaultDealSourceId={activeId !== "all" ? activeId : dealSources[0]?.id}
          onClose={() => setAddDealOpen(false)}
          onCreated={handleDealCreated}
        />
      )}

      {historyDealId && (
        <DealStageHistoryDialog dealId={historyDealId} onClose={() => setHistoryDealId(null)} />
      )}
    </div>
  );
}
