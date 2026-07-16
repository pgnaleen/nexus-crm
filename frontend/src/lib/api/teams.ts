import type { CreateTeamRequest, TeamResponse, UpdateTeamRequest } from "@orelia/common";
import { apiFetch } from "./client";

export function createTeam(payload: CreateTeamRequest): Promise<TeamResponse> {
  return apiFetch<TeamResponse>("/teams", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTeam(id: string, payload: UpdateTeamRequest): Promise<TeamResponse> {
  return apiFetch<TeamResponse>(`/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteTeam(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/teams/${id}`, { method: "DELETE" });
}
