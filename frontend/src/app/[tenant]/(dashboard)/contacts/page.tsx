"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const hasFilters = search !== "" || roleFilter !== "" || statusFilter !== "";

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Contacts</h1>
          <p className="funnel-subtitle">Manage people and relationships</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add Contact
        </button>
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="funnel-filters-selects">
            <CustomSelect 
              label="Role"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "", label: "All" },
                { value: "decision_maker", label: "Decision Maker" },
                { value: "influencer", label: "Influencer" },
                { value: "champion", label: "Champion" }
              ]}
            />
            
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
                setRoleFilter("");
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
          <p className="empty-state-title">No contacts found</p>
          <p className="empty-state-message">Add your first contact to start building relationships.</p>
        </div>
      </div>
    </div>
  );
}
