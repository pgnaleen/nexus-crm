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
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Contacts</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">Manage people and relationships</p>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
        >
          Add Contact
        </button>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
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
          <div>
            <button
              type="button"
              className="cursor-pointer rounded-md border-none bg-transparent px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#e2e8f0] hover:text-crm-text"
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
