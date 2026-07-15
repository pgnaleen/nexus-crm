"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function TeamsManagementPage() {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const hasFilters = search !== "" || departmentFilter !== "";

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Teams Management</h1>
          <p className="funnel-subtitle">Organize users into collaborative groups</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add Team
        </button>
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input 
              type="text" 
              placeholder="Search teams..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="funnel-filters-selects">
            <CustomSelect 
              label="Department"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: "", label: "All" },
                { value: "sales", label: "Sales" },
                { value: "marketing", label: "Marketing" },
                { value: "engineering", label: "Engineering" },
                { value: "support", label: "Support" }
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
                setDepartmentFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="empty-state">
          <p className="empty-state-title">No teams found</p>
          <p className="empty-state-message">Create a team to start collaborating.</p>
        </div>
      </div>
    </div>
  );
}
