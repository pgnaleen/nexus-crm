import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { SystemTenantCache, TenantContextService } from "../../core/tenant";
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
  private readonly logger = new Logger(RbacService.name);

  constructor(
    @InjectRepository(RbacRoleUserMap)
    private readonly roleUserMapRepo: Repository<RbacRoleUserMap>,
    @InjectRepository(RbacRoleResourceMap)
    private readonly roleResourceMapRepo: Repository<RbacRoleResourceMap>,
    @InjectRepository(RbacResource)
    private readonly resourceRepo: Repository<RbacResource>,
    private readonly rolesRepo: RbacRolesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly systemTenantCache: SystemTenantCache,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getRoleNamesForUser(userId: string): Promise<string[]> {
    this.logger.debug(`getRoleNamesForUser called for user ${userId}`);
    const maps = await this.roleUserMapRepo.find({
      where: { userId },
      relations: ["role"],
    });
    const names = maps.map((map) => map.role!.name);
    this.logger.debug(`getRoleNamesForUser returning ${names.length} role name(s) for user ${userId}`);
    return names;
  }

  // Batch version of getRoleNamesForUser -- one query for the whole list
  // (UsersController.findAll's row count) instead of N, same reasoning as
  // every other bulk picker in this codebase. Every id in userIds is present
  // in the result (possibly with an empty array), so callers never need an
  // extra `?? []` fallback.
  async getRoleNamesForUsers(userIds: string[]): Promise<Record<string, string[]>> {
    this.logger.debug(`getRoleNamesForUsers called for ${userIds.length} user(s)`);
    const result: Record<string, string[]> = {};
    for (const id of userIds) result[id] = [];
    if (userIds.length === 0) return result;

    const maps = await this.roleUserMapRepo.find({
      where: { userId: In(userIds) },
      relations: ["role"],
    });
    for (const map of maps) {
      result[map.userId]!.push(map.role!.name);
    }
    this.logger.debug(`getRoleNamesForUsers resolved role names for ${maps.length} mapping(s)`);
    return result;
  }

  async getPermissionsForUser(userId: string): Promise<string[]> {
    this.logger.debug(`getPermissionsForUser called for user ${userId}`);
    const roleMaps = await this.roleUserMapRepo.find({ where: { userId } });
    const roleIds = roleMaps.map((map) => map.roleId);
    if (roleIds.length === 0) {
      this.logger.debug(`getPermissionsForUser: user ${userId} holds no roles, returning empty`);
      return [];
    }

    const resourceMaps = await this.roleResourceMapRepo.find({
      where: { roleId: In(roleIds) },
      relations: ["resource"],
    });

    const permissionNames = resourceMaps.map((map) => map.resource!.name);
    const unique = Array.from(new Set(permissionNames));
    this.logger.debug(`getPermissionsForUser returning ${unique.length} unique permission(s) for user ${userId}`);
    return unique;
  }

  async findAllRoles(): Promise<Array<{ role: RbacRole; resourceCount: number }>> {
    this.logger.debug("findAllRoles called");
    const roles = await this.rolesRepo.findScoped({ order: { name: "ASC" } });
    if (roles.length === 0) {
      this.logger.debug("findAllRoles: no roles for this tenant, returning empty");
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

    this.logger.debug(`findAllRoles returning ${roles.length} role(s)`);
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
    this.logger.debug(`createRole called by ${userId} (name="${dto.name}")`);
    try {
      const role = this.rolesRepo.createScoped({ ...dto, createdBy: userId });
      const saved = await this.rolesRepo.saveScoped(role);
      this.logger.debug(`createRole succeeded for role ${saved.id}`);
      await this.auditLogService.record({
        entityType: "rbac_role",
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { ...dto },
      });
      return saved;
    } catch (err) {
      this.logger.error(`createRole failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async updateRole(id: string, dto: UpdateRoleDto, userId: string): Promise<RbacRole> {
    this.logger.debug(`updateRole called for role ${id} by ${userId}`);
    const role = await this.findRoleOrFail(id);

    const before: Record<string, unknown> = {};
    const roleAsRecord = role as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = roleAsRecord[key];
    }

    try {
      Object.assign(role, dto, { updatedBy: userId });
      await this.rolesRepo.saveScoped(role);
      // Re-fetch rather than return the in-memory object: any field the caller
      // omitted from dto ends up as an explicit `undefined` own-property (a
      // declared-but-unset TS class field), which Object.assign then copies
      // onto `role`. TypeORM's save() correctly skips undefined columns in the
      // generated UPDATE (the DB value is never touched), but the in-memory
      // object stays stale — returning it directly would misreport those
      // untouched fields as missing/null in the API response.
      const updated = await this.findRoleOrFail(id);
      this.logger.debug(`updateRole succeeded for role ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = updated as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = updatedAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: "rbac_role",
          entityId: id,
          action: "update",
          actorId: userId,
          changes,
        });
      }

      return updated;
    } catch (err) {
      this.logger.error(`updateRole failed for role ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async removeRole(id: string, userId: string): Promise<void> {
    this.logger.debug(`removeRole called for role ${id} by ${userId}`);
    const role = await this.findRoleOrFail(id);
    try {
      await this.rolesRepo.softRemoveScoped(role, userId);
      this.logger.debug(`removeRole succeeded for role ${id}`);
      await this.auditLogService.record({
        entityType: "rbac_role",
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: role.name },
      });
    } catch (err) {
      this.logger.error(`removeRole failed for role ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  /** Resources assignable from the current tenant — isPlatformOnly ones only show up for the System tenant. */
  async findAllResources(): Promise<RbacResource[]> {
    this.logger.debug("findAllResources called");
    const isPlatform = await this.isCurrentTenantPlatform();
    const resources = await this.resourceRepo.find({ order: { name: "ASC" } });
    const visible = resources
      .filter((resource) => isPlatform || !resource.isPlatformOnly)
      .filter((resource) => !this.isHiddenFromPicker(resource.name));
    this.logger.debug(`findAllResources returning ${visible.length} resource(s) (isPlatform=${isPlatform})`);
    return visible;
  }

  // Companies/Contacts have no controller anywhere that checks their own
  // permission keys today -- all real Company/Contact access is gated
  // exclusively by the four RELATIONSHIP_* permissions on
  // relationship-parties.controller.ts. Toggling companies:*/contacts:* in
  // the Roles picker would do nothing but confuse an admin into thinking it
  // matters. Kept in permissions.ts (not deleted) for a future module (e.g.
  // Legal) that may need its own genuine Company/Contact access -- hidden
  // here rather than removed, so no data/rows are lost in the meantime.
  private static readonly HIDDEN_FROM_PICKER_PREFIXES = ["companies", "contacts"];

  private isHiddenFromPicker(resourceName: string): boolean {
    const prefix = resourceName.split(":")[0] ?? "";
    return RbacService.HIDDEN_FROM_PICKER_PREFIXES.includes(prefix);
  }

  async getResourceIdsForRole(roleId: string): Promise<string[]> {
    const maps = await this.roleResourceMapRepo.find({ where: { roleId } });
    return maps.map((map) => map.resourceId);
  }

  async assignResourcesToRole(roleId: string, dto: AssignRoleResourcesDto, userId: string): Promise<void> {
    this.logger.debug(`assignResourcesToRole called for role ${roleId} by ${userId} (${dto.resourceIds.length} resource(s))`);
    await this.findRoleOrFail(roleId); // also confirms the role belongs to the current tenant
    const { resourceIds } = dto;

    if (resourceIds.length > 0) {
      const resources = await this.resourceRepo.find({ where: { id: In(resourceIds) } });
      if (resources.length !== resourceIds.length) {
        this.logger.debug(`Blocked: assignResourcesToRole for role ${roleId} referenced a resource id that doesn't exist`);
        throw new NotFoundException("One or more resources not found");
      }

      const isPlatform = await this.isCurrentTenantPlatform();
      if (!isPlatform && resources.some((resource) => resource.isPlatformOnly)) {
        this.logger.debug(`Blocked: role ${roleId} (non-platform tenant) tried to be granted a platform-only resource`);
        throw new ForbiddenException(
          "Platform-only permissions can only be assigned to roles in the System tenant",
        );
      }
    }

    try {
      const before = await this.getResourceIdsForRole(roleId);
      await this.roleResourceMapRepo.delete({ roleId });
      if (resourceIds.length > 0) {
        const rows = resourceIds.map((resourceId) =>
          this.roleResourceMapRepo.create({ roleId, resourceId, createdBy: userId }),
        );
        await this.roleResourceMapRepo.save(rows);
      }
      this.logger.debug(`assignResourcesToRole succeeded for role ${roleId}`);
      await this.auditLogService.record({
        entityType: "rbac_role",
        entityId: roleId,
        action: "update",
        actorId: userId,
        changes: { resourceIds: { old: before, new: resourceIds } },
      });
    } catch (err) {
      this.logger.error(`assignResourcesToRole failed for role ${roleId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  /**
   * Evaluates against the AMBIENT tenant (TenantContextService), which is
   * deliberately the impersonated tenant when act-as-tenant is active -- see
   * SystemTenantCache. This keeps platform-only resource gating correct
   * while acting as a non-System tenant (you can't grant a Tenant X role a
   * platform-only permission just because you're impersonating it).
   */
  async isCurrentTenantPlatform(): Promise<boolean> {
    return this.systemTenantCache.isSystemTenant(this.tenantContext.getTenantId());
  }

  /**
   * Assigns roles to a user. Validates roleIds through the ambient
   * (possibly impersonated) tenant via findScoped -- this is what makes it
   * safe to not take an explicit tenantId param: the roles a caller can
   * assign are always whichever tenant TenantContextService currently
   * resolves to, exactly like every other write in this service.
   */
  async assignRolesToUser(userId: string, roleIds: string[], createdBy: string): Promise<void> {
    this.logger.debug(`assignRolesToUser called for user ${userId} by ${createdBy} (${roleIds.length} role(s))`);
    if (roleIds.length === 0) {
      this.logger.debug("assignRolesToUser: empty roleIds, nothing to do");
      return;
    }
    try {
      const roles = await this.rolesRepo.findScoped({ where: { id: In(roleIds) } });
      if (roles.length !== roleIds.length) {
        this.logger.debug(`Blocked: assignRolesToUser for user ${userId} referenced a role id not found for this tenant`);
        throw new NotFoundException("One or more roles not found for the current tenant");
      }
      const rows = roleIds.map((roleId) => this.roleUserMapRepo.create({ roleId, userId, createdBy }));
      await this.roleUserMapRepo.save(rows);
      this.logger.debug(`assignRolesToUser succeeded for user ${userId}`);
      await this.auditLogService.record({
        entityType: "user",
        entityId: userId,
        action: "update",
        actorId: createdBy,
        changes: { addedRoleIds: roleIds },
      });
    } catch (err) {
      this.logger.error(`assignRolesToUser failed for user ${userId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async getRoleIdsForUser(userId: string): Promise<string[]> {
    const maps = await this.roleUserMapRepo.find({ where: { userId } });
    return maps.map((map) => map.roleId);
  }

  /**
   * Full replace (not incremental) -- clears every existing role grant for
   * the user then re-assigns the given set, so removing a role from the
   * Edit User form is just "not in roleIds" rather than needing a separate
   * unassign call. roleIds still validated through the ambient tenant via
   * findScoped, same safety property as assignRolesToUser.
   */
  async replaceRolesForUser(userId: string, roleIds: string[], updatedBy: string): Promise<void> {
    this.logger.debug(`replaceRolesForUser called for user ${userId} by ${updatedBy} (${roleIds.length} role(s))`);
    try {
      const before = await this.getRoleIdsForUser(userId);
      await this.roleUserMapRepo.delete({ userId });
      if (roleIds.length === 0) {
        this.logger.debug(`replaceRolesForUser: clearing all roles for user ${userId}`);
        await this.auditLogService.record({
          entityType: "user",
          entityId: userId,
          action: "update",
          actorId: updatedBy,
          changes: { roleIds: { old: before, new: [] } },
        });
        return;
      }
      const roles = await this.rolesRepo.findScoped({ where: { id: In(roleIds) } });
      if (roles.length !== roleIds.length) {
        this.logger.debug(`Blocked: replaceRolesForUser for user ${userId} referenced a role id not found for this tenant`);
        throw new NotFoundException("One or more roles not found for the current tenant");
      }
      const rows = roleIds.map((roleId) => this.roleUserMapRepo.create({ roleId, userId, createdBy: updatedBy }));
      await this.roleUserMapRepo.save(rows);
      this.logger.debug(`replaceRolesForUser succeeded for user ${userId}`);
      await this.auditLogService.record({
        entityType: "user",
        entityId: userId,
        action: "update",
        actorId: updatedBy,
        changes: { roleIds: { old: before, new: roleIds } },
      });
    } catch (err) {
      this.logger.error(`replaceRolesForUser failed for user ${userId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
