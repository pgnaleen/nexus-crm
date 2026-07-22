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
  | { mode: "edit"; dealSource: DealSourceResponse }
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

  const canView   = permissions.includes(PERMISSIONS.DEAL_SOURCE_VIEW);
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
    <div className="tenant-management-wrapper">
      {canImpersonate && (
        <TenantActingAsSwitcher
          tenants={tenants}
          currentTenantId={currentTenantId}
          actingTenant={actingTenant}
        />
      )}

      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Deal Sources</h1>
          <p className="funnel-subtitle">
            Manage lead and deal acquisition channels such as Website, Referral, and Cold Call
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Source
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((source) => (
                <tr
                  key={source.id}
                  className={canUpdate ? "interactive-row" : undefined}
                  onClick={
                    canUpdate
                      ? () => setDialogState({ mode: "edit", dealSource: source })
                      : undefined
                  }
                >
                  <td style={{ fontWeight: 500 }}>{source.name}</td>
                  <td>{source.category ? (
                    <code className="slug-badge">{CATEGORY_LABELS[source.category]}</code>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
                  )}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: source.isActive ? "#e6f7ee" : "#f3f4f6",
                        color: source.isActive ? "#1a9c5f" : "#6b7280",
                      }}
                    >
                      {source.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(source.createdAt)}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
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
