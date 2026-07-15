import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { TenantContextService, TenantStore } from "./tenant-context.service";

interface RequestUser {
  sub?: string;
  tenantId?: string;
  roles?: string[];
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();

    const store: TenantStore = {
      tenantId: req.user?.tenantId,
      userId: req.user?.sub,
      roles: req.user?.roles ?? [],
    };

    return this.tenantContext.run(store, () => next.handle());
  }
}
