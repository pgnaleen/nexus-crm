import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

export interface TenantStore {
  tenantId?: string;
  userId?: string;
  roles: string[];
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, callback: () => T): T {
    return this.als.run(store, callback);
  }

  private getStore(): TenantStore {
    const store = this.als.getStore();
    if (!store) {
      throw new Error("TenantContext accessed outside of a request scope");
    }
    return store;
  }

  getTenantId(): string {
    const { tenantId } = this.getStore();
    if (!tenantId) {
      throw new Error("Tenant context has no tenantId set for this request");
    }
    return tenantId;
  }

  getUserId(): string | undefined {
    return this.getStore().userId;
  }

  getRoles(): string[] {
    return this.getStore().roles;
  }
}
