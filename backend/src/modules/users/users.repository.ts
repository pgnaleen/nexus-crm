import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersRepository extends BaseTenantRepository<User> {
  constructor(
    @InjectRepository(User) repo: Repository<User>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(user: User, actorId?: string): Promise<void> {
    if (user.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(user);
    await this.repo.update(user.id, { deletedBy: actorId });
  }
}
