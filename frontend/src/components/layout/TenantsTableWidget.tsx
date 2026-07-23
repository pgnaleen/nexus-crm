"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { IndustryResponse, PlanResponse, TenantResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteTenant } from "@/lib/api/tenants";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EditIcon, PlusIcon, TrashIcon, SearchIcon, EyeIcon, ExternalLinkIcon } from "@/components/ui/icons";
import { TenantFormDialog } from "@/components/layout/TenantFormDialog";
import { TenantDetailsDialog } from "@/components/layout/TenantDetailsDialog";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";

interface TenantsTableWidgetProps {
  tenants: TenantSummaryResponse[];
  plans: PlanResponse[];
  industries: IndustryResponse[];
  permissions: string[];
}

type DialogState = { mode: "create" } | { mode: "edit" | "view"; tenant: TenantSummaryResponse } | null;

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

  const confirm = useConfirm();
  const { showError } = useAlert();

  const canView = permissions.includes(PERMISSIONS.TENANTS_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.TENANTS_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.TENANTS_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.TENANTS_DELETE);
  const showActionsColumn = true;

  const hasFilters = search !== "" || planFilter !== "" || industryFilter !== "";

  const filteredTenants = tenants.filter((tenant) => {
    if (search && !tenant.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (planFilter && tenant.planId !== planFilter) return false;
    if (industryFilter && tenant.industryId !== industryFilter) return false;
    return true;
  });

  async function initiateDelete(tenant: TenantSummaryResponse) {
    const ok = await confirm({
      title: "Delete Tenant",
      message: `Are you sure you want to delete "${tenant.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(tenant.id);
    try {
      await deleteTenant(tenant.id);
      setTenants((current) => current.filter((item) => item.id !== tenant.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete tenant");
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
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Tenant Management</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">Manage all companies, workspaces, and accounts</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Tenant
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
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
          <div>
            <button
              type="button"
              className="cursor-pointer rounded-md border-none bg-transparent px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#e2e8f0] hover:text-crm-text"
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
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                Name
              </th>
              <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                Slug
              </th>
              <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                Plan
              </th>
              <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                Industry
              </th>
              <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                Status
              </th>
              {showActionsColumn && (
                <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
              )}
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((tenant) => (
              <tr
                key={tenant.id}
                className={
                  canView
                    ? "cursor-pointer transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f1f5f9]"
                    : "transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                }
                onClick={canView ? () => setDialogState({ mode: "view", tenant }) : undefined}
              >
                <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{tenant.name}</td>
                <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{tenant.slug}</td>
                <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{tenant.planName}</td>
                <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                  {tenant.industryName ?? <span className="text-[var(--color-text-muted)]">&mdash;</span>}
                </td>
                <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                  <StatusBadge status={tenant.status} />
                </td>
                {showActionsColumn && (
                  <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Open login for ${tenant.name}`}
                      title={`Open login page for ${tenant.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/${tenant.slug}`, "_blank");
                      }}
                    >
                      <ExternalLinkIcon size={15} />
                    </button>
                    {canUpdate && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${tenant.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialogState({ mode: "edit", tenant });
                        }}
                      >
                        <EditIcon size={15} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        aria-label={`Delete ${tenant.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          initiateDelete(tenant);
                        }}
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

      {dialogState?.mode === "view" && (
        <TenantDetailsDialog
          open={true}
          tenant={"tenant" in dialogState ? dialogState.tenant : null}
          onClose={() => setDialogState(null)}
        />
      )}

      {dialogState && dialogState.mode !== "view" && (
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
