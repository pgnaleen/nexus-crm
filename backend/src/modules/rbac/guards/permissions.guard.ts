import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { PERMISSION_KEY } from "../decorators/require-permission.decorator";
import { RbacService } from "../rbac.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | string[] | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new ForbiddenException("Not authenticated");
    }

    const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const permissions = await this.rbacService.getPermissionsForUser(userId);
    if (!required.some((permission) => permissions.includes(permission))) {
      throw new ForbiddenException(`Missing required permission: ${required.join(" or ")}`);
    }

    return true;
  }
}
