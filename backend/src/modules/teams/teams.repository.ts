import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Team } from "./entities/team.entity";

@Injectable()
export class TeamsRepository extends BaseTenantRepository<Team> {
  constructor(
    @InjectRepository(Team) repo: Repository<Team>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(team: Team): Promise<void> {
    if (team.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(team);
  }
}
