"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const hasFilters = search !== "" || departmentFilter !== "" || roleFilter !== "";

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">User Management</h1>
          <p className="funnel-subtitle">Manage team access and permissions</p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add User
        </button>
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input 
              type="text" 
              placeholder="Search users..." 
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
                { value: "engineering", label: "Engineering" }
              ]}
            />
            
            <CustomSelect 
              label="Role"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "", label: "All" },
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
                { value: "member", label: "Member" }
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
                setRoleFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="empty-state">
          <p className="empty-state-title">No users found</p>
          <p className="empty-state-message">Add users to grant them access to this workspace.</p>
        </div>
      </div>
    </div>
  );
}
