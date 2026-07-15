import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tenant } from "../tenants/entities/tenant.entity";
import { RbacResource } from "./entities/rbac-resource.entity";
import { RbacRole } from "./entities/rbac-role.entity";
import { RbacRoleResourceMap } from "./entities/rbac-role-resource-map.entity";
import { RbacRoleUserMap } from "./entities/rbac-role-user-map.entity";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RbacController } from "./rbac.controller";
import { RbacRolesRepository } from "./rbac-roles.repository";
import { RbacService } from "./rbac.service";

@Module({
  imports: [
    // Tenant is registered here too (already registered in TenantsModule) to
    // avoid a circular module import — TenantsModule already imports RbacModule.
    TypeOrmModule.forFeature([RbacResource, RbacRole, RbacRoleResourceMap, RbacRoleUserMap, Tenant]),
  ],
  controllers: [RbacController],
  providers: [RbacService, RbacRolesRepository, PermissionsGuard],
  exports: [RbacService, PermissionsGuard, TypeOrmModule],
})
export class RbacModule {}
