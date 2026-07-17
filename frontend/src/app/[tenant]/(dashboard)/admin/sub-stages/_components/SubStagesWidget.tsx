"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import type {
  ActingTenant,
  DealStageResponse,
  MainStageResponse,
  TenantSummaryResponse,
} from "@orelia/common";
import { deleteSubStage } from "@/lib/api/sub-stages";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { SubStageFormDialog } from "./SubStageFormDialog";

interface SubStagesWidgetProps {
  subStages: DealStageResponse[];
  mainStages: MainStageResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; subStage: DealStageResponse }
  | null;

export function SubStagesWidget({
  subStages: initialSubStages,
  mainStages,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: SubStagesWidgetProps) {
  const [subStages, setSubStages] = useState(initialSubStages);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError } = useAlert();

  const hasManage = permissions.includes(PERMISSIONS.SUB_STAGE_MANAGE);
  const canView   = hasManage || permissions.includes(PERMISSIONS.SUB_STAGE_VIEW);
  const canCreate = hasManage || permissions.includes(PERMISSIONS.SUB_STAGE_CREATE);
  const canUpdate = hasManage || permissions.includes(PERMISSIONS.SUB_STAGE_UPDATE);
  const canDelete = hasManage || permissions.includes(PERMISSIONS.SUB_STAGE_DELETE);
  const canImpersonate =
    isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const mainStageNameById = new Map(mainStages.map((stage) => [stage.id, stage.name]));

  function mainStageName(mainStageId: string): string {
    return mainStageNameById.get(mainStageId) ?? "—";
  }

  const filteredSubStages = subStages
    .filter(
      (s) =>
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        mainStageName(s.mainStageId).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const stageCompare = mainStageName(a.mainStageId).localeCompare(mainStageName(b.mainStageId));
      return stageCompare !== 0 ? stageCompare : a.sortOrder - b.sortOrder;
    });

  function handleSaved(subStage: DealStageResponse) {
    setSubStages((current) => {
      const exists = current.some((item) => item.id === subStage.id);
      return exists
        ? current.map((item) => (item.id === subStage.id ? subStage : item))
        : [...current, subStage];
    });
    router.refresh();
  }

  async function initiateDelete(subStage: DealStageResponse) {
    const ok = await confirm({
      title: "Delete Sub Stage",
      message: `Are you sure you want to delete "${subStage.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(subStage.id);
    try {
      await deleteSubStage(subStage.id);
      setSubStages((current) => current.filter((item) => item.id !== subStage.id));
      router.refresh();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete sub stage");
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
          <h1 className="funnel-title">Sub Stages</h1>
          <p className="funnel-subtitle">
            Manage the detailed stages within each main pipeline stage
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setDialogState({ mode: "create" })}
            disabled={mainStages.length === 0}
          >
            Add Sub Stage
          </button>
        )}
      </div>

      {mainStages.length === 0 && (
        <p className="field-error" style={{ marginTop: 0 }}>
          Create at least one Main Stage first before adding sub stages.
        </p>
      )}

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by name or main stage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredSubStages.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No sub stages found</p>
            <p className="empty-state-message">
              {subStages.length === 0
                ? "No sub stages exist yet. Add one to get started."
                : "No sub stages match your search."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Main Stage</th>
                <th>Order</th>
                <th>Outcome</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredSubStages.map((subStage) => (
                <tr
                  key={subStage.id}
                  className={canUpdate ? "interactive-row" : undefined}
                  onClick={
                    canUpdate ? () => setDialogState({ mode: "edit", subStage }) : undefined
                  }
                >
                  <td style={{ fontWeight: 500 }}>{subStage.name}</td>
                  <td>{mainStageName(subStage.mainStageId)}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{subStage.sortOrder}</td>
                  <td>
                    {subStage.isWon && (
                      <span
                        className="status-badge"
                        style={{ background: "#e6f7ee", color: "#1a9c5f" }}
                      >
                        Won
                      </span>
                    )}
                    {subStage.isLost && (
                      <span
                        className="status-badge"
                        style={{ background: "#fdf0ee", color: "#c0392b", marginLeft: "6px" }}
                      >
                        Lost
                      </span>
                    )}
                    {!subStage.isWon && !subStage.isLost && (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </td>
                  {showActionsColumn && (
                    <td className="table-actions">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${subStage.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "edit", subStage });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${subStage.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(subStage);
                          }}
                          disabled={deletingId === subStage.id}
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
        <SubStageFormDialog
          mode={dialogState.mode}
          subStage={dialogState.mode === "edit" ? dialogState.subStage : undefined}
          mainStages={mainStages}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
