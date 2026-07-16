"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/ui/icons";

export function EmployeesWidget() {
  const [search, setSearch] = useState("");

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Employees</h1>
          <p className="funnel-subtitle">
            Manage your organization's internal team members and their details
          </p>
        </div>
        <button type="button" className="funnel-add-btn">
          Add Employee
        </button>
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search employees by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="empty-state-title">No employees found</p>
          <p className="empty-state-message">
            There are no employees to display right now.
          </p>
        </div>
      </div>
    </div>
  );
}
