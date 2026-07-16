import { ITeam } from "../types";

export type TeamResponse = ITeam;

export interface CreateTeamRequest {
  name: string;
}

export type UpdateTeamRequest = Partial<CreateTeamRequest>;
