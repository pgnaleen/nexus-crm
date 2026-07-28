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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Teams Management</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">Organize users into collaborative groups</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-none bg-crm-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            onClick={() => setDialogState({ mode: "create" })}
          >
            Add Team
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3 rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
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
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  Name
                </th>
                {showActionsColumn && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => (
                <tr
                  key={team.id}
                  className="transition-colors duration-150 [&:last-child>td]:border-b-0 hover:bg-[#f7f8fc]"
                >
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{team.name}</td>
                  {showActionsColumn && (
                    <td className="flex justify-end gap-1.5 border-b border-[var(--color-border)] p-3">
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
          </div>
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
