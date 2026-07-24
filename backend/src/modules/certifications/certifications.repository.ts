import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { EmployeeCertification } from "./entities/employee-certification.entity";

@Injectable()
export class CertificationsRepository extends BaseTenantRepository<EmployeeCertification> {
  constructor(
    @InjectRepository(EmployeeCertification) repo: Repository<EmployeeCertification>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  // Same two-step softRemove()+update() pattern as teams/employees --
  // softRemove sets deletedAt, the follow-up update stamps deletedBy.
  async softRemoveScoped(certification: EmployeeCertification, actorId?: string): Promise<void> {
    if (certification.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(certification);
    await this.repo.update(certification.id, { deletedBy: actorId });
  }
}
