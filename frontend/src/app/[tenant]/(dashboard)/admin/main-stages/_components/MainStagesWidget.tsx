"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import type { ActingTenant, MainStageResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteMainStage } from "@/lib/api/main-stages";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useCascadeDeleteConfirm, useConfirm, useAlert } from "@/components/providers/DialogProvider";
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
  | { mode: "edit" | "view"; mainStage: MainStageResponse }
  | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
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
  const confirmCascadeDelete = useCascadeDeleteConfirm();
  const { showError } = useAlert();

  const canCreate = permissions.includes(PERMISSIONS.MAIN_STAGE_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.MAIN_STAGE_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.MAIN_STAGE_DELETE);
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
    const hasDependents = stage.dependentCount > 0;
    const ok = hasDependents
      ? await confirmCascadeDelete({
          title: "Delete Main Stage",
          warningMessage: `Deleting "${stage.name}" will also delete ${stage.dependentCount} ${
            stage.dependentCount === 1 ? "sub-stage" : "sub-stages"
          } under it. This action cannot be undone.`,
        })
      : await confirm({
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
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Main Stages</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">
            Manage high-level stages of your deal pipeline
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Main Stage
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
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
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
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="w-20 border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Pos
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Name
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
              {filteredStages.map((stage) => (
                <tr
                  key={stage.id}
                  className="transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                >
                  <td className="border-b border-[var(--color-border)] p-3 text-[var(--color-text-muted)]">
                    {stage.position}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                    {stage.name}
                    {stage.dependentCount === 0 && (
                      <span
                        className="ml-2 inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                        style={{ background: "#fff7e6", color: "#b8860b" }}
                        title="Deals can't move into this stage until it has at least one sub stage"
                      >
                        No sub stages
                      </span>
                    )}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {formatDate(stage.createdAt)}
                  </td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
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
          mainStages={stages}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
