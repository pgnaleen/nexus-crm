"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import type { ActingTenant, MainStageResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteMainStage } from "@/lib/api/main-stages";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { MainStageFormDialog } from "./MainStageFormDialog";

interface MainStagesWidgetProps {
  mainStages: MainStageResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; mainStage: MainStageResponse }
  | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
  });
}

export function MainStagesWidget({
  mainStages: initialStages,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: MainStagesWidgetProps) {
  const [stages, setStages] = useState(initialStages);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError } = useAlert();

  const hasManage = permissions.includes(PERMISSIONS.MAIN_STAGE_MANAGE);
  const canView   = hasManage || permissions.includes(PERMISSIONS.MAIN_STAGE_VIEW);
  const canCreate = hasManage || permissions.includes(PERMISSIONS.MAIN_STAGE_CREATE);
  const canUpdate = hasManage || permissions.includes(PERMISSIONS.MAIN_STAGE_UPDATE);
  const canDelete = hasManage || permissions.includes(PERMISSIONS.MAIN_STAGE_DELETE);
  const canImpersonate =
    isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const filteredStages = stages
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  function handleSaved(stage: MainStageResponse) {
    setStages((current) => {
      const exists = current.some((item) => item.id === stage.id);
      return exists
        ? current.map((item) => (item.id === stage.id ? stage : item))
        : [...current, stage];
    });
    router.refresh();
  }

  async function initiateDelete(stage: MainStageResponse) {
    const ok = await confirm({
      title: "Delete Main Stage",
      message: `Are you sure you want to delete "${stage.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(stage.id);
    try {
      await deleteMainStage(stage.id);
      setStages((current) => current.filter((item) => item.id !== stage.id));
      router.refresh();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete main stage");
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
          <h1 className="funnel-title">Main Stages</h1>
          <p className="funnel-subtitle">
            Manage high-level stages of your deal pipeline
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Main Stage
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredStages.length === 0 ? (
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
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <p className="empty-state-title">No main stages found</p>
            <p className="empty-state-message">
              {stages.length === 0
                ? "No main stages exist yet. Add one to get started."
                : "No main stages match your search."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Pos</th>
                <th>Name</th>
                <th>Created</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredStages.map((stage) => (
                <tr
                  key={stage.id}
                  className={canUpdate ? "interactive-row" : undefined}
                  onClick={
                    canUpdate
                      ? () => setDialogState({ mode: "edit", mainStage: stage })
                      : undefined
                  }
                >
                  <td style={{ color: "var(--color-text-muted)" }}>{stage.position}</td>
                  <td style={{ fontWeight: 500 }}>{stage.name}</td>
                  <td>{formatDate(stage.createdAt)}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${stage.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "edit", mainStage: stage });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${stage.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(stage);
                          }}
                          disabled={deletingId === stage.id}
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
        <MainStageFormDialog
          mode={dialogState.mode}
          mainStage={dialogState.mode === "edit" ? dialogState.mainStage : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
