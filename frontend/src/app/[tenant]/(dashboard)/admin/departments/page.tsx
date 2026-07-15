"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function DepartmentsManagementPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const hasFilters = search !== "" || statusFilter !== "";

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Department Management</h1>
          <p className="funnel-subtitle">Configure organizational departments</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add Department
        </button>
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input 
              type="text" 
              placeholder="Search departments..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="funnel-filters-selects">
            <CustomSelect 
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" }
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
                setStatusFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="empty-state">
          <p className="empty-state-title">No departments found</p>
          <p className="empty-state-message">Add your first department.</p>
        </div>
      </div>
    </div>
  );
}
