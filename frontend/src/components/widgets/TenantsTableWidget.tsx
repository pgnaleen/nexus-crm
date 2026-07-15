"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { IndustryResponse, PlanResponse, TenantResponse } from "@orelia/common";
import { deleteTenant } from "@/lib/api/tenants";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EditIcon, PlusIcon, TrashIcon, SearchIcon } from "@/components/ui/icons";
import { TenantFormDialog } from "@/components/widgets/TenantFormDialog";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface TenantsTableWidgetProps {
  tenants: TenantResponse[];
  plans: PlanResponse[];
  industries: IndustryResponse[];
  permissions: string[];
}

type DialogState = { mode: "create" } | { mode: "edit"; tenant: TenantResponse } | null;

export function TenantsTableWidget({
  tenants: initialTenants,
  plans,
  industries,
  permissions,
}: TenantsTableWidgetProps) {
  const [tenants, setTenants] = useState(initialTenants);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

  const canCreate = permissions.includes(PERMISSIONS.TENANTS_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.TENANTS_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.TENANTS_DELETE);
  const showActionsColumn = canUpdate || canDelete;

  const hasFilters = search !== "" || planFilter !== "" || industryFilter !== "";

  const filteredTenants = tenants.filter((tenant) => {
    if (search && !tenant.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (planFilter && tenant.planId !== planFilter) return false;
    if (industryFilter && tenant.industryId !== industryFilter) return false;
    return true;
  });

  async function handleDelete(tenant: TenantResponse) {
    if (!window.confirm(`Delete tenant "${tenant.name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(tenant.id);
    try {
      await deleteTenant(tenant.id);
      setTenants((current) => current.filter((item) => item.id !== tenant.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete tenant");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(tenant: TenantResponse) {
    setTenants((current) => {
      const exists = current.some((item) => item.id === tenant.id);
      return exists
        ? current.map((item) => (item.id === tenant.id ? tenant : item))
        : [...current, tenant].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  return (
    <div className="tenant-management-wrapper">
      {/* ── Title ──────────────────────── */}
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Tenant Management</h1>
          <p className="funnel-subtitle">Manage all companies, workspaces, and accounts</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Tenant
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="funnel-filters-selects">
            <CustomSelect 
              label="Plan"
              value={planFilter}
              onChange={setPlanFilter}
              options={[
                { value: "", label: "All" },
                ...plans.map(p => ({ value: p.id, label: p.name }))
              ]}
            />
            
            <CustomSelect 
              label="Industry"
              value={industryFilter}
              onChange={setIndustryFilter}
              options={[
                { value: "", label: "All" },
                ...industries.map(i => ({ value: i.id, label: i.name }))
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
                setPlanFilter("");
                setIndustryFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="content-card">

      {filteredTenants.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No tenants found</p>
          <p className="empty-state-message">No tenants match the current filters.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Plan</th>
              <th>Industry</th>
              <th>Status</th>
              {showActionsColumn && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.name}</td>
                <td>{tenant.slug}</td>
                <td>{tenant.planName}</td>
                <td>{tenant.industryName ?? "—"}</td>
                <td>
                  <StatusBadge status={tenant.status} />
                </td>
                {showActionsColumn && (
                  <td className="table-actions">
                    {canUpdate && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${tenant.name}`}
                        onClick={() => setDialogState({ mode: "edit", tenant })}
                      >
                        <EditIcon size={15} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        aria-label={`Delete ${tenant.name}`}
                        onClick={() => handleDelete(tenant)}
                        disabled={deletingId === tenant.id}
                      >
                        <TrashIcon size={15} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      </div>

      {dialogState && (
        <TenantFormDialog
          mode={dialogState.mode}
          tenant={"tenant" in dialogState ? dialogState.tenant : undefined}
          plans={plans}
          industries={industries}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
