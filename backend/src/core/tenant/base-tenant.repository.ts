import { ForbiddenException } from "@nestjs/common";
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from "typeorm";
import { TenantContextService } from "./tenant-context.service";
import { TenantOwnedEntity } from "./tenant-owned.entity";

export class BaseTenantRepository<T extends TenantOwnedEntity> {
  constructor(
    protected readonly repo: Repository<T>,
    protected readonly tenantContext: TenantContextService,
  ) {}

  findOneScoped(options: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne(this.scopeOptions(options));
  }

  findScoped(options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repo.find(this.scopeOptions(options));
  }

  createScoped(data: DeepPartial<T>): T {
    return this.repo.create({
      ...data,
      tenantId: this.tenantContext.getTenantId(),
    } as DeepPartial<T>);
  }

  async saveScoped(entity: T): Promise<T> {
    if (entity.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    return this.repo.save(entity);
  }

  queryBuilderScoped(alias: string) {
    return this.repo
      .createQueryBuilder(alias)
      .andWhere(`${alias}.tenant_id = :tenantId`, {
        tenantId: this.tenantContext.getTenantId(),
      });
  }

  private scopeOptions<O extends FindOneOptions<T> | FindManyOptions<T>>(options: O): O {
    const tenantId = this.tenantContext.getTenantId();
    return {
      ...options,
      where: {
        ...(options.where as FindOptionsWhere<T>),
        tenantId,
      },
    } as O;
  }
}
