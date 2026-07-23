"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import type { ActingTenant, DealSourceResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteDealSource } from "@/lib/api/deal-sources";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { CATEGORY_LABELS, DealSourceFormDialog } from "./DealSourceFormDialog";

interface DealSourcesWidgetProps {
  dealSources: DealSourceResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit" | "view"; dealSource: DealSourceResponse }
  | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
  });
}

export function DealSourcesWidget({
  dealSources: initialSources,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: DealSourcesWidgetProps) {
  const [sources, setSources] = useState(initialSources);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError } = useAlert();

  const canCreate = permissions.includes(PERMISSIONS.DEAL_SOURCE_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.DEAL_SOURCE_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.DEAL_SOURCE_DELETE);
  const canImpersonate =
    isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const filteredSources = sources.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.category ? CATEGORY_LABELS[s.category] : "").toLowerCase().includes(search.toLowerCase()),
  );

  function handleSaved(source: DealSourceResponse) {
    setSources((current) => {
      const exists = current.some((item) => item.id === source.id);
      return exists
        ? current.map((item) => (item.id === source.id ? source : item))
        : [...current, source].sort((a, b) => a.name.localeCompare(b.name));
    });
    router.refresh();
  }

  async function initiateDelete(source: DealSourceResponse) {
    const ok = await confirm({
      title: "Delete Deal Source",
      message: `Are you sure you want to delete "${source.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(source.id);
    try {
      await deleteDealSource(source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      router.refresh();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete deal source");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      {canImpersonate && (
        <TenantActingAsSwitcher
          tenants={tenants}
          currentTenantId={currentTenantId}
          actingTenant={actingTenant}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Deal Sources</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">
            Manage lead and deal acquisition channels such as Website, Referral, and Cold Call
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Source
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
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredSources.length === 0 ? (
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <p className="empty-state-title">No deal sources found</p>
            <p className="empty-state-message">
              {sources.length === 0
                ? "No deal sources exist yet. Add one to get started."
                : "No deal sources match your search."}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Name
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Category
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Status
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Created
                </th>
                {showActionsColumn && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((source) => (
                <tr
                  key={source.id}
                  className="transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                >
                  <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                    {source.name}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {source.category ? (
                      <code className="slug-badge">{CATEGORY_LABELS[source.category]}</code>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    <span
                      className="inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                      style={{
                        background: source.isActive ? "#e6f7ee" : "#f3f4f6",
                        color: source.isActive ? "#1a9c5f" : "#6b7280",
                      }}
                    >
                      {source.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {formatDate(source.createdAt)}
                  </td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${source.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "edit", dealSource: source });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${source.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(source);
                          }}
                          disabled={deletingId === source.id}
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
        <DealSourceFormDialog
          mode={dialogState.mode}
          dealSource={dialogState.mode === "edit" ? dialogState.dealSource : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
