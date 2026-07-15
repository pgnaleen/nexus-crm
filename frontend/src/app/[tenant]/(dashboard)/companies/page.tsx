"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  const hasFilters = search !== "" || industryFilter !== "" || regionFilter !== "";

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Companies</h1>
          <p className="funnel-subtitle">Manage client organizations and accounts</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add Company
        </button>
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input 
              type="text" 
              placeholder="Search companies..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="funnel-filters-selects">
            <CustomSelect 
              label="Industry"
              value={industryFilter}
              onChange={setIndustryFilter}
              options={[
                { value: "", label: "All" },
                { value: "tech", label: "Technology" },
                { value: "finance", label: "Finance" },
                { value: "healthcare", label: "Healthcare" }
              ]}
            />
            
            <CustomSelect 
              label="Region"
              value={regionFilter}
              onChange={setRegionFilter}
              options={[
                { value: "", label: "All" },
                { value: "na", label: "North America" },
                { value: "emea", label: "EMEA" },
                { value: "apac", label: "APAC" }
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
                setIndustryFilter("");
                setRegionFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="empty-state">
          <p className="empty-state-title">No companies found</p>
          <p className="empty-state-message">Add companies to start tracking accounts.</p>
        </div>
      </div>
    </div>
  );
}
