import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { RbacRoleResourceMap } from "./entities/rbac-role-resource-map.entity";
import { RbacRoleUserMap } from "./entities/rbac-role-user-map.entity";

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RbacRoleUserMap)
    private readonly roleUserMapRepo: Repository<RbacRoleUserMap>,
    @InjectRepository(RbacRoleResourceMap)
    private readonly roleResourceMapRepo: Repository<RbacRoleResourceMap>,
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
}
