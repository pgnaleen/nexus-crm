import { UserStatus } from "@orelia/common";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { RbacService } from "../rbac/rbac.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly rbacService: RbacService,
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
    const user = await this.findOneOrFail(id);
    Object.assign(user, dto, { updatedBy });
    await this.usersRepo.saveScoped(user);
    // Re-fetch rather than return the in-memory object -- Object.assign
    // leaves an omitted dto field as an explicit `undefined` own-property,
    // which would misreport that field as empty even though save() (which
    // skips undefined columns) left the DB value untouched.
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
