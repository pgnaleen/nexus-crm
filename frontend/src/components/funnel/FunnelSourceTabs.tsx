"use client";

import { useState } from "react";
import { FUNNEL_SOURCES, type FunnelLead, type FunnelStage } from "@/lib/data/funnel";
import { FunnelBoard } from "@/components/funnel/FunnelBoard";
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

/* ── Build initial state ────────────────────────────────────── */
function buildInitialLeads() {
  const map: Record<string, FunnelLead[]> = {};
  for (const src of FUNNEL_SOURCES) {
    map[src.id] = src.leads.map((l) => ({ ...l }));
  }
  return map;
}

export function FunnelSourceTabs() {
  const [activeId, setActiveId] = useState(FUNNEL_SOURCES[0].id);
  const [leadsBySource, setLeadsBySource] = useState(buildInitialLeads);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");

  const hasFilters = search !== "" || department !== "" || country !== "";

  const activeLeads = leadsBySource[activeId] ?? [];
  const activeCfg = SOURCE_CONFIG[activeId] ?? { accent: "#2f6feb", bg: "#dbeafe" };

  function handleMove(leadId: string, toStage: FunnelStage) {
    setLeadsBySource((prev) => ({
      ...prev,
      [activeId]: prev[activeId].map((l) =>
        l.id === leadId ? { ...l, stage: toStage } : l
      ),
    }));
  }

  return (
    <div className="funnel-page">
      {/* ── Title ──────────────────────── */}
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Funnel</h1>
          <p className="funnel-subtitle">Track deals by acquisition source</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add New Deal
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
          {FUNNEL_SOURCES.map((src) => {
            const cfg = SOURCE_CONFIG[src.id] ?? activeCfg;
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
                {src.label}
              </button>
            );
          })}
        </div>

        {/* ── Kanban board container ──────────────────────── */}
        <div 
          className="funnel-board-wrapper" 
          style={{ borderTop: `3px solid ${activeCfg.accent}` }}
        >
          <FunnelBoard leads={activeLeads} onMove={handleMove} />
        </div>
      </div>
    </div>
  );
}
