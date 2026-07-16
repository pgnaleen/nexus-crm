import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tenant } from "../../modules/tenants/entities/tenant.entity";

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves the System tenant's id without a DB round-trip on every check --
 * the System tenant is effectively immutable (never renamed/recreated via
 * any UI), so a short-TTL in-memory cache is safe and removes a query from
 * what would otherwise be a per-request hot path (isCurrentTenantPlatform
 * is checked on every act-as-tenant attempt and several RBAC operations).
 */
@Injectable()
export class SystemTenantCache {
  constructor(@InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>) {}

  private cachedId: string | null = null;
  private cachedAt = 0;

  async getSystemTenantId(): Promise<string> {
    const isStale = Date.now() - this.cachedAt > CACHE_TTL_MS;
    if (this.cachedId && !isStale) {
      return this.cachedId;
    }
    const tenant = await this.tenantRepo.findOneByOrFail({ slug: SYSTEM_TENANT_SLUG });
    this.cachedId = tenant.id;
    this.cachedAt = Date.now();
    return this.cachedId;
  }

  async isSystemTenant(tenantId: string): Promise<boolean> {
    return tenantId === (await this.getSystemTenantId());
  }
}
