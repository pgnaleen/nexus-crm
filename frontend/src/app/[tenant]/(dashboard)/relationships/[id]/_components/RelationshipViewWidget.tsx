"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import type {
  ActingTenant,
  CompanyPickerResponse,
  EmployeePickerResponse,
  IndustryResponse,
  RelationshipPartyResponse,
  RelationshipTypeResponse,
  TenantSummaryResponse,
} from "@orelia/common";
import {
  deleteRelationshipParty,
  disableRelationshipParty,
  enableRelationshipParty,
  listRelationshipParties,
} from "@/lib/api/relationship-parties";
import { ApiError } from "@/lib/api/client";
import { BuildingIcon, EditIcon, SearchIcon, TrashIcon, UserIcon, BanIcon, CheckCircleIcon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/Dialog";
import { TenantActingAsSwitcher } from "@/components/layout/TenantActingAsSwitcher";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
import { CompanyFormDialog } from "./CompanyFormDialog";
import { ContactFormDialog } from "./ContactFormDialog";

interface RelationshipViewWidgetProps {
  relationshipType: RelationshipTypeResponse;
  parties: RelationshipPartyResponse[];
  permissions: string[];
  currentTenantId: string;
  isPlatformSession: boolean;
  tenants: TenantSummaryResponse[];
  actingTenant: ActingTenant | null;
  industries: IndustryResponse[];
  employees: EmployeePickerResponse[];
  companies: CompanyPickerResponse[];
}

type DialogState =
  | { mode: "choose" }
  | { mode: "create-company" }
  | { mode: "create-contact" }
  | { mode: "edit-company"; party: RelationshipPartyResponse }
  | { mode: "edit-contact"; party: RelationshipPartyResponse }
  | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium" });
}

function partyName(party: RelationshipPartyResponse): string {
  return party.kind === "company" ? (party.company?.name ?? "") : (party.contact?.fullName ?? "");
}

function partyDetail(party: RelationshipPartyResponse): string {
  if (party.kind === "company") {
    return party.company?.country ?? party.company?.url ?? "";
  }
  return party.contact?.email ?? party.contact?.mobileNo ?? "";
}

export function RelationshipViewWidget({
  relationshipType,
  parties: initialParties,
  permissions,
  currentTenantId,
  isPlatformSession,
  tenants,
  actingTenant,
  industries,
  employees,
  companies,
}: RelationshipViewWidgetProps) {
  const [parties, setParties] = useState(initialParties);
  const [search, setSearch] = useState("");
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError } = useAlert();

  const hasManage = permissions.includes(PERMISSIONS.RELATIONSHIP_MANAGE);
  const canView = hasManage || permissions.includes(PERMISSIONS.RELATIONSHIP_VIEW);
  const canCreate = hasManage || permissions.includes(PERMISSIONS.RELATIONSHIP_CREATE);
  const canUpdate = hasManage || permissions.includes(PERMISSIONS.RELATIONSHIP_UPDATE);
  const canDelete = hasManage || permissions.includes(PERMISSIONS.RELATIONSHIP_DELETE);
  const canImpersonate =
    isPlatformSession && permissions.includes(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT);
  const showActionsColumn = canUpdate || canDelete;

  const filteredParties = parties.filter((party) => {
    if (!search) return true;
    const haystack = `${partyName(party)} ${partyDetail(party)}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  function handleSaved() {
    void refreshParties();
  }

  async function refreshParties() {
    try {
      const fresh = await listRelationshipParties(relationshipType.id);
      setParties(fresh);
    } catch {
      // Non-fatal -- the dialog already closed; the list simply stays stale
      // until the next natural refresh.
    }
  }

  async function initiateDelete(party: RelationshipPartyResponse) {
    const ok = await confirm({
      title: `Delete ${party.kind === "company" ? "Company" : "Person"}`,
      message: `Remove "${partyName(party)}" from ${relationshipType.name}? This cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setBusyId(party.id);
    try {
      await deleteRelationshipParty(relationshipType.id, party.id);
      setParties((current) => current.filter((item) => item.id !== party.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete relationship");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(party: RelationshipPartyResponse) {
    setBusyId(party.id);
    try {
      const updated = party.isActive
        ? await disableRelationshipParty(relationshipType.id, party.id)
        : await enableRelationshipParty(relationshipType.id, party.id);
      setParties((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(party: RelationshipPartyResponse) {
    setDialogState(party.kind === "company" ? { mode: "edit-company", party } : { mode: "edit-contact", party });
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
          <h1 className="funnel-title">{relationshipType.name}</h1>
          <p className="funnel-subtitle">
            Manage all contacts and companies associated with the {relationshipType.name.toLowerCase()} relationship type
          </p>
        </div>
        {canCreate && (
          <button type="button" className="funnel-add-btn" onClick={() => setDialogState({ mode: "choose" })}>
            Add {relationshipType.name}
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder={`Search ${relationshipType.name.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredParties.length === 0 ? (
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
            <p className="empty-state-title">No {relationshipType.name.toLowerCase()} found</p>
            <p className="empty-state-message">
              {parties.length === 0
                ? `There are no entries associated with this relationship type yet.`
                : `No entries match your search.`}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Details</th>
                <th>Status</th>
                <th>Created</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredParties.map((party) => (
                <tr
                  key={party.id}
                  className={canUpdate ? "interactive-row" : undefined}
                  onClick={canUpdate ? () => openEdit(party) : undefined}
                >
                  <td style={{ fontWeight: 500 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      {party.kind === "company" ? <BuildingIcon size={15} /> : <UserIcon size={15} />}
                      {partyName(party)}
                    </span>
                  </td>
                  <td>{party.kind === "company" ? "Company" : "Person"}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{partyDetail(party)}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: party.isActive ? "#e6f7ee" : "#f3f4f6",
                        color: party.isActive ? "#1a9c5f" : "#6b7280",
                      }}
                    >
                      {party.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(party.createdAt)}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${partyName(party)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(party);
                          }}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={party.isActive ? `Disable ${partyName(party)}` : `Enable ${partyName(party)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActive(party);
                          }}
                          disabled={busyId === party.id}
                        >
                          {party.isActive ? <BanIcon size={15} /> : <CheckCircleIcon size={15} />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${partyName(party)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateDelete(party);
                          }}
                          disabled={busyId === party.id}
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

      {dialogState?.mode === "choose" && (
        <Dialog open title={`Add ${relationshipType.name}`} onClose={() => setDialogState(null)} maxWidth="420px">
          <p style={{ marginBottom: "16px", color: "var(--color-text-muted)" }}>
            Is this a company or an individual person?
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              className="funnel-add-btn"
              style={{ flex: 1, justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
              onClick={() => setDialogState({ mode: "create-company" })}
            >
              <BuildingIcon size={16} /> Company
            </button>
            <button
              type="button"
              className="funnel-add-btn"
              style={{ flex: 1, justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
              onClick={() => setDialogState({ mode: "create-contact" })}
            >
              <UserIcon size={16} /> Person
            </button>
          </div>
        </Dialog>
      )}

      {dialogState?.mode === "create-company" && (
        <CompanyFormDialog
          mode="create"
          relationshipTypeId={relationshipType.id}
          relationshipTypeName={relationshipType.name}
          industries={industries}
          employees={employees}
          companies={companies}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}

      {dialogState?.mode === "create-contact" && (
        <ContactFormDialog
          mode="create"
          relationshipTypeId={relationshipType.id}
          relationshipTypeName={relationshipType.name}
          companies={companies}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}

      {dialogState?.mode === "edit-company" && dialogState.party.company && (
        <CompanyFormDialog
          mode="edit"
          relationshipTypeId={relationshipType.id}
          relationshipTypeName={relationshipType.name}
          mapId={dialogState.party.id}
          company={dialogState.party.company}
          industries={industries}
          employees={employees}
          companies={companies}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}

      {dialogState?.mode === "edit-contact" && dialogState.party.contact && (
        <ContactFormDialog
          mode="edit"
          relationshipTypeId={relationshipType.id}
          relationshipTypeName={relationshipType.name}
          mapId={dialogState.party.id}
          contact={dialogState.party.contact}
          companies={companies}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
