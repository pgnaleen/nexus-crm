import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { Observable, throwError } from "rxjs";
import { ACT_AS_TENANT_COOKIE, ACT_AS_TENANT_TOKEN_TYPE, ActAsTenantTokenPayload } from "./act-as-tenant.constants";
import { TenantContextService, TenantStore } from "./tenant-context.service";

interface RequestUser {
  sub?: string;
  tenantId?: string;
  roles?: string[];
}

// Writes get no silent fallback on an expired-but-genuine act-as-tenant
// cookie: BaseTenantRepository.createScoped has no tenant-match guard the
// way findScoped/saveScoped do, so silently reverting to the admin's real
// tenant here would let a write the admin believes targets Tenant X land
// under System instead, with no error. Reads degrade gracefully; writes
// don't.
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request & { user?: RequestUser }>();
    const res = httpContext.getResponse<Response>();

    let tenantId = req.user?.tenantId;

    const actAsCookie: string | undefined = req.cookies?.[ACT_AS_TENANT_COOKIE];
    if (actAsCookie) {
      let payload: ActAsTenantTokenPayload | null = null;
      try {
        // Verify the signature first, ignoring expiry -- expiry is checked
        // separately below so a genuinely-expired-but-otherwise-valid
        // cookie can be distinguished from a foreign/forged one.
        payload = this.jwtService.verify<ActAsTenantTokenPayload>(actAsCookie, {
          secret: this.config.get<string>("JWT_ACCESS_SECRET"),
          ignoreExpiration: true,
        });
      } catch {
        payload = null;
      }

      const isMine = payload?.typ === ACT_AS_TENANT_TOKEN_TYPE && payload.actingUserId === req.user?.sub;

      if (!isMine) {
        // Malformed, forged, or a different user's leftover cookie on a
        // shared browser -- never a hard failure, just self-heal.
        res.clearCookie(ACT_AS_TENANT_COOKIE);
      } else {
        const decoded = this.jwtService.decode<(ActAsTenantTokenPayload & { exp: number }) | null>(actAsCookie);
        const isExpired = !decoded?.exp || decoded.exp * 1000 < Date.now();

        if (isExpired && WRITE_METHODS.has(req.method)) {
          res.clearCookie(ACT_AS_TENANT_COOKIE);
          return throwError(
            () => new ForbiddenException("Impersonation session expired -- reselect a tenant to continue"),
          );
        }

        if (isExpired) {
          res.clearCookie(ACT_AS_TENANT_COOKIE);
          res.setHeader("X-Act-As-Tenant-Expired", "1");
        } else {
          tenantId = payload!.actAsTenantId;
        }
      }
    }

    const store: TenantStore = {
      tenantId,
      userId: req.user?.sub,
      roles: req.user?.roles ?? [],
    };

    return this.tenantContext.run(store, () => next.handle());
  }
}
