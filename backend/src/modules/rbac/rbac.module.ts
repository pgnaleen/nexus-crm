import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacResource } from "./entities/rbac-resource.entity";
import { RbacRole } from "./entities/rbac-role.entity";
import { RbacRoleResourceMap } from "./entities/rbac-role-resource-map.entity";
import { RbacRoleUserMap } from "./entities/rbac-role-user-map.entity";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RbacService } from "./rbac.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([RbacResource, RbacRole, RbacRoleResourceMap, RbacRoleUserMap]),
  ],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard, TypeOrmModule],
})
export class RbacModule {}
