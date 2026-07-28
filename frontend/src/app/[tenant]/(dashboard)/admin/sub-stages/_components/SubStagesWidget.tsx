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
  | { mode: "edit" | "view"; subStage: DealStageResponse }
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

  const canCreate = permissions.includes(PERMISSIONS.SUB_STAGE_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.SUB_STAGE_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.SUB_STAGE_DELETE);
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
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Sub Stages</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">
            Manage the detailed stages within each main pipeline stage
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-50"
            onClick={() => setDialogState({ mode: "create" })}
            disabled={mainStages.length === 0}
          >
            Add Sub Stage
          </button>
        )}
      </div>

      {mainStages.length === 0 && (
        <p className="mt-0 text-[12.5px] text-[var(--color-danger)]">
          Create at least one Main Stage first before adding sub stages.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3 rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by name or main stage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
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
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Name
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Main Stage
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Order
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Outcome
                </th>
                {showActionsColumn && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredSubStages.map((subStage) => (
                <tr
                  key={subStage.id}
                  className="transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                >
                  <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                    {subStage.name}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {mainStageName(subStage.mainStageId)}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-[var(--color-text-muted)]">
                    {subStage.sortOrder}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {subStage.isWon && (
                      <span
                        className="inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                        style={{ background: "#e6f7ee", color: "#1a9c5f" }}
                      >
                        Won
                      </span>
                    )}
                    {subStage.isLost && (
                      <span
                        className="ml-1.5 inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                        style={{ background: "#fdf0ee", color: "#c0392b" }}
                      >
                        Lost
                      </span>
                    )}
                    {!subStage.isWon && !subStage.isLost && (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
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
          </div>
        )}
      </div>

      {dialogState && (
        <SubStageFormDialog
          mode={dialogState.mode}
          subStage={dialogState.mode === "edit" ? dialogState.subStage : undefined}
          mainStages={mainStages}
          subStages={subStages}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
