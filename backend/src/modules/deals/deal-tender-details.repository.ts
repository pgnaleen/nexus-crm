import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { DealTenderDetails } from "./entities/deal-tender-details.entity";

@Injectable()
export class DealTenderDetailsRepository extends BaseTenantRepository<DealTenderDetails> {
  constructor(
    @InjectRepository(DealTenderDetails) repo: Repository<DealTenderDetails>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }
}
