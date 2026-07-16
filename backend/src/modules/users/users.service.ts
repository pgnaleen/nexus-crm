import { UserStatus } from "@orelia/common";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { RbacService } from "../rbac/rbac.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { RefreshToken } from "./entities/refresh-token.entity";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly rbacService: RbacService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepo.findScoped({ order: { displayName: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<User> {
    const user = await this.usersRepo.findOneScoped({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async create(dto: CreateUserDto, createdBy: string): Promise<User> {
    await this.assertUsernameAvailable(dto.username);

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    const user = this.usersRepo.createScoped({
      username: dto.username,
      displayName: dto.displayName,
      loggingEmail: dto.loggingEmail,
      passwordHash,
      status: dto.status ?? UserStatus.Active,
      // No invite-email flow exists yet, so the admin sets the initial
      // password directly -- mirrors how the seeded admin account works.
      mustChangePassword: dto.mustChangePassword ?? true,
      extras: dto.extras,
      createdBy,
    });
    const saved = await this.usersRepo.saveScoped(user);

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.rbacService.assignRolesToUser(saved.id, dto.roleIds, createdBy);
    }

    return saved;
  }

  async update(id: string, dto: UpdateUserDto, updatedBy: string): Promise<User> {
    // roleIds isn't a User column -- Object.assign-ing it in would just
    // create a stray, TypeORM-ignored property, so it's handled separately
    // via RbacService rather than folded into the entity save below.
    const { roleIds, ...fields } = dto;
    const user = await this.findOneOrFail(id);
    Object.assign(user, fields, { updatedBy });
    await this.usersRepo.saveScoped(user);

    if (roleIds !== undefined) {
      await this.rbacService.replaceRolesForUser(id, roleIds, updatedBy);
    }

    // Re-fetch rather than return the in-memory object -- Object.assign
    // leaves an omitted dto field as an explicit `undefined` own-property,
    // which would misreport that field as empty even though save() (which
    // skips undefined columns) left the DB value untouched.
    return this.findOneOrFail(id);
  }

  async resetPassword(id: string, newPassword: string, updatedBy: string): Promise<void> {
    const user = await this.findOneOrFail(id);
    user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    // Admin-initiated reset always forces a change on next login -- the
    // admin only sets a temporary password, they shouldn't be the one who
    // gets to pick the user's actual ongoing password.
    user.mustChangePassword = true;
    user.updatedBy = updatedBy;
    await this.usersRepo.saveScoped(user);
  }

  async disable(id: string, actingUserId: string): Promise<User> {
    if (id === actingUserId) {
      throw new ForbiddenException("You cannot disable your own account");
    }
    const user = await this.findOneOrFail(id);
    user.status = UserStatus.Disabled;
    user.updatedBy = actingUserId;
    await this.usersRepo.saveScoped(user);
    // Status alone only blocks future logins -- refresh() doesn't currently
    // check status, so an already-issued refresh token would keep silently
    // minting new access tokens for a "disabled" user. Revoke every
    // outstanding token so disabling actually ends their active session,
    // not just their ability to start a new one.
    await this.refreshTokenRepo.update({ userId: id }, { revokedAt: new Date() });
    return this.findOneOrFail(id);
  }

  async enable(id: string, actingUserId: string): Promise<User> {
    const user = await this.findOneOrFail(id);
    user.status = UserStatus.Active;
    user.updatedBy = actingUserId;
    await this.usersRepo.saveScoped(user);
    return this.findOneOrFail(id);
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    if (id === actingUserId) {
      throw new ForbiddenException("You cannot delete your own account");
    }
    const user = await this.findOneOrFail(id);
    await this.usersRepo.softRemoveScoped(user);
  }

  private async assertUsernameAvailable(username: string): Promise<void> {
    const existing = await this.usersRepo.findOneScoped({ where: { username } });
    if (existing) {
      throw new ConflictException(`Username "${username}" is already in use`);
    }
  }
}
