import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TenantContextService } from "../../core/tenant";
import { Tenant } from "../tenants/entities/tenant.entity";
import { AssignRoleResourcesDto } from "./dto/assign-role-resources.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RbacResource } from "./entities/rbac-resource.entity";
import { RbacRole } from "./entities/rbac-role.entity";
import { RbacRoleResourceMap } from "./entities/rbac-role-resource-map.entity";
import { RbacRoleUserMap } from "./entities/rbac-role-user-map.entity";
import { RbacRolesRepository } from "./rbac-roles.repository";

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RbacRoleUserMap)
    private readonly roleUserMapRepo: Repository<RbacRoleUserMap>,
    @InjectRepository(RbacRoleResourceMap)
    private readonly roleResourceMapRepo: Repository<RbacRoleResourceMap>,
    @InjectRepository(RbacResource)
    private readonly resourceRepo: Repository<RbacResource>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly rolesRepo: RbacRolesRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getRoleNamesForUser(userId: string): Promise<string[]> {
    const maps = await this.roleUserMapRepo.find({
      where: { userId },
      relations: ["role"],
    });
    return maps.map((map) => map.role!.name);
  }

  async getPermissionsForUser(userId: string): Promise<string[]> {
    const roleMaps = await this.roleUserMapRepo.find({ where: { userId } });
    const roleIds = roleMaps.map((map) => map.roleId);
    if (roleIds.length === 0) {
      return [];
    }

    const resourceMaps = await this.roleResourceMapRepo.find({
      where: { roleId: In(roleIds) },
      relations: ["resource"],
    });

    const permissionNames = resourceMaps.map((map) => map.resource!.name);
    return Array.from(new Set(permissionNames));
  }

  async findAllRoles(): Promise<Array<{ role: RbacRole; resourceCount: number }>> {
    const roles = await this.rolesRepo.findScoped({ order: { name: "ASC" } });
    if (roles.length === 0) {
      return [];
    }

    const counts = await this.roleResourceMapRepo
      .createQueryBuilder("map")
      .select("map.role_id", "roleId")
      .addSelect("COUNT(*)", "count")
      .where("map.role_id IN (:...roleIds)", { roleIds: roles.map((role) => role.id) })
      .groupBy("map.role_id")
      .getRawMany<{ roleId: string; count: string }>();
    const countByRoleId = new Map(counts.map((row) => [row.roleId, Number(row.count)]));

    return roles.map((role) => ({ role, resourceCount: countByRoleId.get(role.id) ?? 0 }));
  }

  async findRoleOrFail(id: string): Promise<RbacRole> {
    const role = await this.rolesRepo.findOneScoped({ where: { id } });
    if (!role) {
      throw new NotFoundException("Role not found");
    }
    return role;
  }

  async createRole(dto: CreateRoleDto, userId: string): Promise<RbacRole> {
    const role = this.rolesRepo.createScoped({ ...dto, createdBy: userId });
    return this.rolesRepo.saveScoped(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto, userId: string): Promise<RbacRole> {
    const role = await this.findRoleOrFail(id);
    Object.assign(role, dto, { updatedBy: userId });
    await this.rolesRepo.saveScoped(role);
    // Re-fetch rather than return the in-memory object: any field the caller
    // omitted from dto ends up as an explicit `undefined` own-property (a
    // declared-but-unset TS class field), which Object.assign then copies
    // onto `role`. TypeORM's save() correctly skips undefined columns in the
    // generated UPDATE (the DB value is never touched), but the in-memory
    // object stays stale — returning it directly would misreport those
    // untouched fields as missing/null in the API response.
    return this.findRoleOrFail(id);
  }

  async removeRole(id: string): Promise<void> {
    const role = await this.findRoleOrFail(id);
    await this.rolesRepo.softRemoveScoped(role);
  }

  /** Resources assignable from the current tenant — isPlatformOnly ones only show up for the System tenant. */
  async findAllResources(): Promise<RbacResource[]> {
    const isPlatform = await this.isCurrentTenantPlatform();
    const resources = await this.resourceRepo.find({ order: { name: "ASC" } });
    return isPlatform ? resources : resources.filter((resource) => !resource.isPlatformOnly);
  }

  async getResourceIdsForRole(roleId: string): Promise<string[]> {
    const maps = await this.roleResourceMapRepo.find({ where: { roleId } });
    return maps.map((map) => map.resourceId);
  }

  async assignResourcesToRole(roleId: string, dto: AssignRoleResourcesDto, userId: string): Promise<void> {
    await this.findRoleOrFail(roleId); // also confirms the role belongs to the current tenant
    const { resourceIds } = dto;

    if (resourceIds.length > 0) {
      const resources = await this.resourceRepo.find({ where: { id: In(resourceIds) } });
      if (resources.length !== resourceIds.length) {
        throw new NotFoundException("One or more resources not found");
      }

      const isPlatform = await this.isCurrentTenantPlatform();
      if (!isPlatform && resources.some((resource) => resource.isPlatformOnly)) {
        throw new ForbiddenException(
          "Platform-only permissions can only be assigned to roles in the System tenant",
        );
      }
    }

    await this.roleResourceMapRepo.delete({ roleId });
    if (resourceIds.length > 0) {
      const rows = resourceIds.map((resourceId) =>
        this.roleResourceMapRepo.create({ roleId, resourceId, createdBy: userId }),
      );
      await this.roleResourceMapRepo.save(rows);
    }
  }

  private async isCurrentTenantPlatform(): Promise<boolean> {
    const tenantId = this.tenantContext.getTenantId();
    const tenant = await this.tenantRepo.findOneByOrFail({ id: tenantId });
    return tenant.slug === SYSTEM_TENANT_SLUG;
  }
}
