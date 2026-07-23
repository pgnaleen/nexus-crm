"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import type { ActingTenant, RelationshipTypeResponse, TenantSummaryResponse } from "@orelia/common";
import { deleteRelationshipType } from "@/lib/api/relationship-types";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useCascadeDeleteConfirm, useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { RelationshipTypeFormDialog } from "./RelationshipTypeFormDialog";

interface RelationshipTypesWidgetProps {
  relationshipTypes: RelationshipTypeResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit" | "view"; relationshipType: RelationshipTypeResponse }
  | null;

// Format ISO date string for display
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
  });
}

export function RelationshipTypesWidget({
  relationshipTypes: initialTypes,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
}: RelationshipTypesWidgetProps) {
  const [types, setTypes] = useState(initialTypes);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();
  const confirmCascadeDelete = useCascadeDeleteConfirm();
  const { showError } = useAlert();

  const canView   = permissions.includes(PERMISSIONS.RELATIONSHIP_TYPE_VIEW);
  const canCreate = permissions.includes(PERMISSIONS.RELATIONSHIP_TYPE_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.RELATIONSHIP_TYPE_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.RELATIONSHIP_TYPE_DELETE);
  const canImpersonate =
    isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const filteredTypes = types.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSaved(type: RelationshipTypeResponse) {
    setTypes((current) => {
      const exists = current.some((item) => item.id === type.id);
      return exists
        ? current.map((item) => (item.id === type.id ? type : item))
        : [...current, type].sort((a, b) => a.name.localeCompare(b.name));
    });
    router.refresh();
  }

  async function initiateDelete(type: RelationshipTypeResponse) {
    const hasDependents = type.dependentCount > 0;
    const ok = hasDependents
      ? await confirmCascadeDelete({
          title: "Delete Relationship Type",
          warningMessage: `Deleting "${type.name}" will also delete ${type.dependentCount} tagged ${
            type.dependentCount === 1 ? "Company/Contact" : "Companies/Contacts"
          } linked to it. This action cannot be undone.`,
        })
      : await confirm({
          title: "Delete Relationship Type",
          message: `Are you sure you want to delete "${type.name}"? This action cannot be undone.`,
          confirmLabel: "Delete",
          isDestructive: true,
        });
    if (!ok) return;

    setDeletingId(type.id);
    try {
      await deleteRelationshipType(type.id);
      setTypes((current) => current.filter((item) => item.id !== type.id));
      router.refresh();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete relationship type");
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
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Relationship Types</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">
            Manage relationship groupings such as Customers, Suppliers, and Partners
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Type
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
        {filteredTypes.length === 0 ? (
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
            <p className="empty-state-title">No relationship types found</p>
            <p className="empty-state-message">
              {types.length === 0
                ? "No relationship types exist yet. Add one to get started."
                : "No relationship types match your search."}
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
                  Created
                </th>
                {showActionsColumn && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((type) => (
                <tr
                  key={type.id}
                  className={
                    canUpdate || canView
                      ? "cursor-pointer transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f1f5f9]"
                      : "transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                  }
                  onClick={
                    canUpdate
                      ? () => setDialogState({ mode: "edit", relationshipType: type })
                      : canView
                        ? () => setDialogState({ mode: "view", relationshipType: type })
                        : undefined
                  }
                >
                  <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                    {type.name}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {formatDate(type.createdAt)}
                  </td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${type.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogState({ mode: "edit", relationshipType: type });
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${type.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(type);
                          }}
                          disabled={deletingId === type.id}
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
        <RelationshipTypeFormDialog
          mode={dialogState.mode}
          relationshipType={
            dialogState.mode === "edit" ? dialogState.relationshipType : undefined
          }
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
