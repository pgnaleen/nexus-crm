import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { Industry } from "./entities/industry.entity";
import { Plan } from "./entities/plan.entity";
import { Tenant } from "./entities/tenant.entity";

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Industry) private readonly industryRepo: Repository<Industry>,
  ) {}

  findAllPlans(): Promise<Plan[]> {
    return this.planRepo.find({ order: { name: "ASC" } });
  }

  findAllIndustries(): Promise<Industry[]> {
    return this.industryRepo.find({ order: { name: "ASC" } });
  }

  async findBySlugOrFail(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOneBy({ slug });
    if (!tenant) {
      throw new NotFoundException("Workspace not found");
    }
    return tenant;
  }

  findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ relations: ["plan", "industry"], order: { name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      relations: ["plan", "industry"],
    });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return tenant;
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    await this.assertSlugAvailable(dto.slug);
    const tenant = this.tenantRepo.create(dto);
    return this.tenantRepo.save(tenant);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOneOrFail(id);
    if (dto.slug && dto.slug !== tenant.slug) {
      await this.assertSlugAvailable(dto.slug);
    }
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOneOrFail(id);
    // Permanently deleting a tenant cascades: every tenant-owned table (teams,
    // users, deals, etc.) has ON DELETE CASCADE on its tenant_id FK, so this
    // wipes all of that tenant's data, not just the registry row.
    await this.tenantRepo.remove(tenant);
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existing = await this.tenantRepo.findOneBy({ slug });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
