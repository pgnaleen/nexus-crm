import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { Team } from "./entities/team.entity";
import { TeamsRepository } from "./teams.repository";

@Injectable()
export class TeamsService {
  constructor(private readonly teamsRepo: TeamsRepository) {}

  async findAll(): Promise<Team[]> {
    return this.teamsRepo.findScoped({ order: { name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<Team> {
    const team = await this.teamsRepo.findOneScoped({ where: { id } });
    if (!team) {
      throw new NotFoundException("Team not found");
    }
    return team;
  }

  async create(dto: CreateTeamDto, userId: string): Promise<Team> {
    const team = this.teamsRepo.createScoped({ ...dto, createdBy: userId });
    return this.teamsRepo.saveScoped(team);
  }

  async update(id: string, dto: UpdateTeamDto, userId: string): Promise<Team> {
    const team = await this.findOneOrFail(id);
    Object.assign(team, dto, { updatedBy: userId });
    await this.teamsRepo.saveScoped(team);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response (see rbac.service.ts).
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOneOrFail(id);
    await this.teamsRepo.softRemoveScoped(team);
  }
}
