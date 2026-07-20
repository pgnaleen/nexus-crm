"use client";

import { useState } from "react";
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
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";



/* ── Per-source accent colours ─────────────────────────────────
   Deal Sources are tenant-defined (created/renamed freely from Admin),
   so colors can't be keyed by name -- each source is assigned a slot by
   its stable position in `dealSources`, cycling past 8. Fixed hue order,
   never re-shuffled by filtering/sorting the tab list. */
const ALL_TAB_CONFIG = { accent: "#475569", bg: "#f1f5f9" };
const SOURCE_PALETTE: { accent: string; bg: string }[] = [
  { accent: "#2a78d6", bg: "#dbeafe" }, // blue
  { accent: "#008300", bg: "#dcfce7" }, // green
  { accent: "#e87ba4", bg: "#fce7f3" }, // magenta
  { accent: "#eda100", bg: "#fef3c7" }, // yellow
  { accent: "#1baf7a", bg: "#ccfbf1" }, // aqua
  { accent: "#eb6834", bg: "#ffedd5" }, // orange
  { accent: "#4a3aa7", bg: "#ede9fe" }, // violet
  { accent: "#e34948", bg: "#fee2e2" }, // red
];

type StageField = "mainStageName" | "currentStageName";

/* ── Convert a real Deal into the board's display shape ──────── */
// stageField selects which deal field drives the column the card lands in:
//   "mainStageName"    → funnel overview board (columns = Main Stages)
//   "currentStageName" → per-main-stage board  (columns = Sub Stages)
function dealToFunnelLead(deal: DealResponse, stageField: StageField): FunnelLead {
  return {
    id: deal.id,
    name: deal.name,
    company: deal.companyName ?? "",
    value: deal.estimatedValue ?? 0,
    stage: deal[stageField] ?? "",
    date: deal.expectedCloseDate ?? "",
    assignee: deal.ownerName ?? "Unassigned",
  };
}

/* ── Build initial state from deals already loaded server-side ─ */
function buildInitialLeads(deals: DealResponse[], stageField: StageField): Record<string, FunnelLead[]> {
  const all: FunnelLead[] = [];
  const bySource: Record<string, FunnelLead[]> = {};
  for (const deal of deals) {
    const lead = dealToFunnelLead(deal, stageField);
    all.push(lead);
    if (deal.sourceId) {
      bySource[deal.sourceId] = [...(bySource[deal.sourceId] ?? []), lead];
    }
  }
  return { ...bySource, all };
}

interface FunnelSourceTabsProps {
  dealSources: DealSourceResponse[];
  columns: FunnelColumn[];
  // Sub Stage options for the Add Deal dialog, when they differ from the
  // board's own `columns` (e.g. the Funnel overview groups its board by Main
  // Stage, but a deal's currentStageId must be a real Sub Stage). Defaults to
  // `columns` when the board is already Sub-Stage-shaped.
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
  const dynamicSources = [
    { id: "all", name: "All" },
    ...dealSources.map((ds) => ({ id: ds.id, name: ds.name })),
  ];

  const sourceColorById = new Map(
    dealSources.map((ds, i) => [ds.id, SOURCE_PALETTE[i % SOURCE_PALETTE.length]])
  );
  const getTabColor = (id: string) => (id === "all" ? ALL_TAB_CONFIG : sourceColorById.get(id) ?? ALL_TAB_CONFIG);

  const [activeId, setActiveId] = useState(dynamicSources[0]?.id ?? "all");
  const [leadsBySource, setLeadsBySource] = useState(() => buildInitialLeads(initialDeals, stageField));
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  const [isAddDealOpen, setAddDealOpen] = useState(false);

  const hasFilters = search !== "" || department !== "" || country !== "";

  const activeLeads = leadsBySource[activeId] ?? [];
  const activeCfg = getTabColor(activeId);

  function handleMove(leadId: string, toStage: string) {
    setLeadsBySource((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] ?? []).map((l) =>
        l.id === leadId ? { ...l, stage: toStage } : l
      ),
    }));
  }

  function handleDealCreated(deal: DealResponse) {
    const lead = dealToFunnelLead(deal, stageField);
    setLeadsBySource((prev) => {
      const next: Record<string, FunnelLead[]> = { ...prev, all: [...(prev.all ?? []), lead] };
      if (deal.sourceId) {
        next[deal.sourceId] = [...(prev[deal.sourceId] ?? []), lead];
      }
      return next;
    });
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
            const cfg = getTabColor(src.id);
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
          <FunnelBoard leads={activeLeads} onMove={handleMove} columns={columns} />
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
    </div>
  );
}
