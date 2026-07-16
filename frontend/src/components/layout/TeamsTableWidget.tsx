"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { TeamResponse } from "@orelia/common";
import { deleteTeam } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";
import { EditIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { TeamFormDialog } from "@/components/layout/TeamFormDialog";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";

interface TeamsTableWidgetProps {
  teams: TeamResponse[];
  permissions: string[];
}

type DialogState = { mode: "create" } | { mode: "edit"; team: TeamResponse } | null;

export function TeamsTableWidget({ teams: initialTeams, permissions }: TeamsTableWidgetProps) {
  const [teams, setTeams] = useState(initialTeams);
  const [search, setSearch] = useState("");
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { showError } = useAlert();

  const canCreate = permissions.includes(PERMISSIONS.TEAMS_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.TEAMS_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.TEAMS_DELETE);
  const showActionsColumn = canUpdate || canDelete;

  const filteredTeams = teams.filter(
    (team) => !search || team.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSaved(team: TeamResponse) {
    setTeams((current) => {
      const exists = current.some((item) => item.id === team.id);
      return exists
        ? current.map((item) => (item.id === team.id ? team : item))
        : [...current, team].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function initiateDelete(team: TeamResponse) {
    const ok = await confirm({
      title: "Delete Team",
      message: `Are you sure you want to delete "${team.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;

    setDeletingId(team.id);
    try {
      await deleteTeam(team.id);
      setTeams((current) => current.filter((item) => item.id !== team.id));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete team");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Teams Management</h1>
          <p className="funnel-subtitle">Organize users into collaborative groups</p>
        </div>
        {canCreate && (
          <button type="button" className="funnel-add-btn" onClick={() => setDialogState({ mode: "create" })}>
            Add Team
          </button>
        )}
      </div>

      <div className="funnel-filters-container">
        <div className="funnel-filters-left">
          <div className="funnel-filters-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="content-card">
        {filteredTeams.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No teams found</p>
            <p className="empty-state-message">
              {teams.length === 0
                ? "Create a team to start collaborating."
                : "No teams match the current search."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                {showActionsColumn && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  {showActionsColumn && (
                    <td className="table-actions">
                      {canUpdate && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${team.name}`}
                          onClick={() => setDialogState({ mode: "edit", team })}
                        >
                          <EditIcon size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${team.name}`}
                          onClick={() => initiateDelete(team)}
                          disabled={deletingId === team.id}
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
        <TeamFormDialog
          mode={dialogState.mode}
          team={"team" in dialogState ? dialogState.team : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
