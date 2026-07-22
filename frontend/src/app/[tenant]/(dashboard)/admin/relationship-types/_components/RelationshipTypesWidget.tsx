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
  | { mode: "edit"; relationshipType: RelationshipTypeResponse }
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
          <h1 className="funnel-title">Relationship Types</h1>
          <p className="funnel-subtitle">
            Manage relationship groupings such as Customers, Suppliers, and Partners
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="funnel-add-btn"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Type
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((type) => (
                <tr key={type.id}>
                  <td style={{ fontWeight: 500 }}>{type.name}</td>
                  <td>{formatDate(type.createdAt)}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
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
