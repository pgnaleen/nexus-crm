"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function DealsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  const hasFilters = search !== "" || stageFilter !== "" || ownerFilter !== "";

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Deals</h1>
          <p className="funnel-subtitle">Manage all sales opportunities</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add Deal
        </button>
      </div>

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
              label="Pipeline Stage"
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: "", label: "All" },
                { value: "new", label: "New Lead" },
                { value: "qualified", label: "Qualified" },
                { value: "negotiation", label: "Negotiation" }
              ]}
            />
            
            <CustomSelect 
              label="Owner"
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={[
                { value: "", label: "All" },
                { value: "me", label: "Assigned to me" },
                { value: "unassigned", label: "Unassigned" }
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
                setStageFilter("");
                setOwnerFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="empty-state">
          <p className="empty-state-title">No deals found</p>
          <p className="empty-state-message">Get started by creating your first deal.</p>
        </div>
      </div>
    </div>
  );
}
