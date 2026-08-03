import { MailDeliveryResult, UserStatus } from "@orelia/common";
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { Not, Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { MailService } from "../../core/mail/mail.service";
import { TenantContextService } from "../../core/tenant";
import { EmployeesService } from "../employees/employees.service";
import { RbacService } from "../rbac/rbac.service";
import { ChangeOwnPasswordDto } from "./dto/change-own-password.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { RefreshToken } from "./entities/refresh-token.entity";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";

const PASSWORD_HASH_ROUNDS = 12;
const AUDIT_ENTITY_TYPE = "user";

// Ambiguous characters (0/O, 1/l/I) excluded -- the expectation is copy/paste
// from the welcome email, but this keeps it hand-typeable too. Matches the
// same strength policy enforced elsewhere (see password-policy.ts: lower,
// upper, digit, special) by construction rather than by validating after.
const TEMP_PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const TEMP_PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_SPECIAL = "!@#%*?-_";
const TEMP_PASSWORD_ALL = TEMP_PASSWORD_LOWER + TEMP_PASSWORD_UPPER + TEMP_PASSWORD_DIGITS + TEMP_PASSWORD_SPECIAL;
const TEMP_PASSWORD_LENGTH = 12;

function randomChar(charset: string): string {
  return charset.charAt(randomInt(charset.length));
}

// Generates a random temporary password for a newly created user -- the
// admin never sets or sees it directly (see CreateUserRequest's comment);
// it's only ever surfaced via the welcome email (MailService.sendWelcomeEmail).
function generateTemporaryPassword(): string {
  const required = [
    randomChar(TEMP_PASSWORD_LOWER),
    randomChar(TEMP_PASSWORD_UPPER),
    randomChar(TEMP_PASSWORD_DIGITS),
    randomChar(TEMP_PASSWORD_SPECIAL),
  ];
  const chars = [
    ...required,
    ...Array.from({ length: TEMP_PASSWORD_LENGTH - required.length }, () => randomChar(TEMP_PASSWORD_ALL)),
  ];
  // Fisher-Yates shuffle (crypto-random) -- otherwise the four required
  // categories would always sit predictably in the first four characters.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const temp = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = temp;
  }
  return chars.join("");
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly rbacService: RbacService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly auditLogService: AuditLogService,
    // Story 1.6 -- the User <-> Employee link lives on employees.user_id and
    // is only ever written from here (User Management), via these methods.
    private readonly employeesService: EmployeesService,
    private readonly mailService: MailService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findAll(): Promise<User[]> {
    this.logger.debug("findAll called");
    return this.usersRepo.findScoped({ order: { displayName: "ASC" } });
  }

  // Lightweight, broadly-accessible listing for dropdowns -- e.g. Priority
  // Tracker's Share/Delegate pickers (Stories 1.5/1.6). Active accounts
  // only (never offer disabled/invited/locked ones), optionally excluding
  // the caller so a user can't pick themselves.
  async findPicker(excludeUserId?: string): Promise<User[]> {
    this.logger.debug(`findPicker called (excludeUserId=${excludeUserId ?? "none"})`);
    try {
      const results = await this.usersRepo.findScoped({
        where: excludeUserId
          ? { status: UserStatus.Active, id: Not(excludeUserId) }
          : { status: UserStatus.Active },
        order: { displayName: "ASC" },
        // Project to id/displayName at the source so this picker query can
        // never carry passwordHash/email/etc. out of the service, regardless of
        // what a future caller does with the result.
        select: { id: true, displayName: true },
      });
      this.logger.debug(`findPicker returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPicker failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async findOneOrFail(id: string): Promise<User> {
    const user = await this.usersRepo.findOneScoped({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  // Returns the delivery outcome alongside the account, not just the account.
  // The temporary password is surfaced in exactly one place -- the welcome
  // email -- so "created the row" and "the human can actually get in" are two
  // different outcomes, and the caller has to be able to tell them apart.
  async create(dto: CreateUserDto, createdBy: string): Promise<{ user: User; welcomeEmail: MailDeliveryResult }> {
    // Never log the generated password -- matches the password/token
    // redaction precedent used everywhere else in this codebase
    // (RequestLoggerMiddleware).
    this.logger.debug(`create called by ${createdBy} (username="${dto.username}")`);
    await this.assertUsernameAvailable(dto.username);

    // The server generates the initial password, not the admin -- it's only
    // ever surfaced via the welcome email below. Since nobody but the new
    // user ever sees it, mustChangePassword is unconditionally true; there's
    // no "admin knows the password and turns this off" case anymore.
    const temporaryPassword = generateTemporaryPassword();

    try {
      const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
      const user = this.usersRepo.createScoped({
        username: dto.username,
        displayName: dto.displayName,
        loggingEmail: dto.loggingEmail,
        passwordHash,
        status: dto.status ?? UserStatus.Active,
        mustChangePassword: true,
        extras: dto.extras,
        createdBy,
      });
      const saved = await this.usersRepo.saveScoped(user);
      this.logger.debug(`create succeeded for user ${saved.id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: createdBy,
        changes: { username: dto.username, displayName: dto.displayName, status: saved.status },
      });

      if (dto.roleIds && dto.roleIds.length > 0) {
        this.logger.debug(`create: assigning ${dto.roleIds.length} role(s) to new user ${saved.id}`);
        await this.rbacService.assignRolesToUser(saved.id, dto.roleIds, createdBy);
      }

      // Story 1.6 -- link the new account to its Employee HR record.
      // linkToUser itself 409s if the employee is already linked elsewhere.
      if (dto.employeeId) {
        this.logger.debug(`create: linking new user ${saved.id} to employee ${dto.employeeId}`);
        await this.employeesService.linkToUser(dto.employeeId, saved.id, createdBy);
      }

      // Sends the "your account was created" email with the username and the
      // server-generated temp password -- this is the ONLY place it's ever
      // surfaced, so a skipped/failed send here means the account exists but
      // its password is unknown to anyone until an admin resets it. Still
      // best-effort by design (see MailService.sendWelcomeEmail): a failed
      // send must never fail the account creation above, which has already
      // committed. The outcome is returned to the caller so the admin is told
      // about it, rather than shown an unqualified success.
      let tenantSlug: string | undefined;
      try {
        tenantSlug = this.tenantContext.getTenantSlug();
      } catch {
        this.logger.warn("create: no tenant context available, skipping welcome email");
      }

      let welcomeEmail: MailDeliveryResult;
      if (tenantSlug) {
        welcomeEmail = await this.mailService.sendWelcomeEmail({
          to: dto.loggingEmail,
          displayName: dto.displayName,
          username: dto.username,
          temporaryPassword,
          tenantSlug,
        });
      } else {
        welcomeEmail = { sent: false, reason: "no_tenant_context" };
      }
      if (!welcomeEmail.sent) {
        this.logger.warn(
          `create: user ${saved.id} was created but the welcome email was NOT delivered ` +
            `(reason=${welcomeEmail.reason}) -- its temporary password is now unknown to anyone`,
        );
      }

      return { user: saved, welcomeEmail };
    } catch (err) {
      // assertUsernameAvailable above is not atomic with the insert -- two
      // concurrent creates for the same username race past it and one hits
      // the UNIQUE(tenant_id, username) index. Translate that Postgres
      // unique-violation (23505) into a clean 409 rather than a raw 500,
      // same pattern as priority-task-shares.service.ts /
      // relationship-parties.service.ts.
      if ((err as { code?: string }).code === "23505") {
        this.logger.debug(`Concurrent duplicate username "${dto.username}" -> 409`);
        throw new ConflictException(`Username "${dto.username}" is already in use`);
      }
      this.logger.error(`create failed for username "${dto.username}": ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto, updatedBy: string): Promise<User> {
    this.logger.debug(`update called for user ${id} by ${updatedBy}`);
    // roleIds/employeeId aren't User columns -- Object.assign-ing them in
    // would just create stray, TypeORM-ignored properties, so they're
    // handled separately (RbacService / EmployeesService) rather than folded
    // into the entity save below.
    const { roleIds, employeeId, ...fields } = dto;
    const user = await this.findOneOrFail(id);

    const before: Record<string, unknown> = {};
    const userAsRecord = user as unknown as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
      before[key] = userAsRecord[key];
    }

    try {
      Object.assign(user, fields, { updatedBy });
      await this.usersRepo.saveScoped(user);
      this.logger.debug(`update succeeded for user ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = user as unknown as Record<string, unknown>;
      for (const key of Object.keys(fields)) {
        const newValue = updatedAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          action: "update",
          actorId: updatedBy,
          changes,
        });
      }

      if (roleIds !== undefined) {
        this.logger.debug(`update: replacing roles for user ${id} (${roleIds.length} role(s))`);
        await this.rbacService.replaceRolesForUser(id, roleIds, updatedBy);
      }

      // Story 1.6 -- employee link, tri-state: undefined = untouched,
      // null = unlink, uuid = link (switching first unlinks the current one).
      if (employeeId !== undefined) {
        const currentlyLinked = await this.employeesService.findByUserId(id);
        if (employeeId === null) {
          this.logger.debug(`update: unlinking employee from user ${id}`);
          await this.employeesService.unlinkFromUser(id, updatedBy);
        } else if (currentlyLinked?.id !== employeeId) {
          this.logger.debug(`update: linking user ${id} to employee ${employeeId} (was ${currentlyLinked?.id ?? "none"})`);
          if (currentlyLinked) {
            await this.employeesService.unlinkFromUser(id, updatedBy);
          }
          await this.employeesService.linkToUser(employeeId, id, updatedBy);
        } else {
          this.logger.debug(`update: employee link for user ${id} unchanged (${employeeId})`);
        }
      }

      // Re-fetch rather than return the in-memory object -- Object.assign
      // leaves an omitted dto field as an explicit `undefined` own-property,
      // which would misreport that field as empty even though save() (which
      // skips undefined columns) left the DB value untouched.
      return this.findOneOrFail(id);
    } catch (err) {
      this.logger.error(`update failed for user ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async resetPassword(id: string, newPassword: string, updatedBy: string): Promise<void> {
    this.logger.debug(`resetPassword called for user ${id} by ${updatedBy}`);
    const user = await this.findOneOrFail(id);
    try {
      const wasLockedOut = !!(user.lockedUntil && user.lockedUntil > new Date());
      user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
      // Admin-initiated reset always forces a change on next login -- the
      // admin only sets a temporary password, they shouldn't be the one who
      // gets to pick the user's actual ongoing password.
      user.mustChangePassword = true;
      // A reset is the admin's "get this person unstuck" action -- it must
      // also clear any active brute-force lockout (see auth.service.ts's
      // LOGIN_LOCKOUT_THRESHOLD/LOGIN_LOCKOUT_DURATION_MS), or a correctly
      // reset password still can't be used until the 15-minute lock expires
      // on its own. Nothing else in this codebase ever clears
      // loggingAttempts/lockedUntil early -- confirmed by grep, this was a
      // real gap (no admin-facing "unlock" existed at all before this).
      // Explicit `null`, not `undefined` -- see the entity's own comment on
      // why `undefined` silently no-ops here.
      user.loggingAttempts = 0;
      user.lockedUntil = null;
      user.updatedBy = updatedBy;
      await this.usersRepo.saveScoped(user);
      this.logger.debug(
        `resetPassword succeeded for user ${id}${wasLockedOut ? " (also cleared an active lockout)" : ""}`,
      );
      // Deliberately no password/hash in changes -- only that a reset happened.
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "update",
        actorId: updatedBy,
        changes: { passwordReset: true, mustChangePassword: true, lockoutCleared: wasLockedOut },
      });
    } catch (err) {
      this.logger.error(`resetPassword failed for user ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async changeOwnPassword(id: string, dto: ChangeOwnPasswordDto, currentTokenHash: string | undefined): Promise<void> {
    this.logger.debug(`changeOwnPassword called for user ${id}`);
    const user = await this.findOneOrFail(id);
    const currentMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentMatches) {
      this.logger.debug(`changeOwnPassword blocked: current password did not match for user ${id}`);
      // 403, not 401 -- the caller's session is fine, they just didn't prove
      // the current password. A 401 here would make apiFetch's global
      // refresh-and-retry treat this like an expired access token.
      throw new ForbiddenException("Current password is incorrect");
    }

    try {
      user.passwordHash = await bcrypt.hash(dto.newPassword, PASSWORD_HASH_ROUNDS);
      // Unlike an admin-initiated reset, this IS the user's real chosen
      // password -- nothing further to force on next login.
      user.mustChangePassword = false;
      user.updatedBy = id;
      await this.usersRepo.saveScoped(user);
      this.logger.debug(`changeOwnPassword succeeded for user ${id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "update",
        actorId: id,
        changes: { passwordSelfChanged: true },
      });

      // Revoke every other active session -- old refresh tokens were minted
      // under the password that just changed. The caller's own token (the
      // session used to make this change) is spared so they aren't logged out
      // of the tab they just used.
      await this.refreshTokenRepo.update(
        currentTokenHash ? { userId: id, tokenHash: Not(currentTokenHash) } : { userId: id },
        { revokedAt: new Date() },
      );
      this.logger.debug(`changeOwnPassword: revoked other active session(s) for user ${id}`);
    } catch (err) {
      this.logger.error(`changeOwnPassword failed for user ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async disable(id: string, actingUserId: string): Promise<User> {
    this.logger.debug(`disable called for user ${id} by ${actingUserId}`);
    if (id === actingUserId) {
      this.logger.debug(`Blocked: user ${actingUserId} tried to disable their own account`);
      throw new ForbiddenException("You cannot disable your own account");
    }
    const user = await this.findOneOrFail(id);
    try {
      user.status = UserStatus.Disabled;
      user.updatedBy = actingUserId;
      await this.usersRepo.saveScoped(user);
      // Status alone only blocks future logins -- refresh() doesn't currently
      // check status, so an already-issued refresh token would keep silently
      // minting new access tokens for a "disabled" user. Revoke every
      // outstanding token so disabling actually ends their active session,
      // not just their ability to start a new one.
      await this.refreshTokenRepo.update({ userId: id }, { revokedAt: new Date() });
      this.logger.debug(`disable succeeded for user ${id}, revoked all active sessions`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "update",
        actorId: actingUserId,
        changes: { status: { old: "active", new: "disabled" } },
      });
      return this.findOneOrFail(id);
    } catch (err) {
      this.logger.error(`disable failed for user ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async enable(id: string, actingUserId: string): Promise<User> {
    this.logger.debug(`enable called for user ${id} by ${actingUserId}`);
    const user = await this.findOneOrFail(id);
    try {
      user.status = UserStatus.Active;
      user.updatedBy = actingUserId;
      await this.usersRepo.saveScoped(user);
      this.logger.debug(`enable succeeded for user ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "update",
        actorId: actingUserId,
        changes: { status: { old: "disabled", new: "active" } },
      });
      return this.findOneOrFail(id);
    } catch (err) {
      this.logger.error(`enable failed for user ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    this.logger.debug(`remove called for user ${id} by ${actingUserId}`);
    if (id === actingUserId) {
      this.logger.debug(`Blocked: user ${actingUserId} tried to delete their own account`);
      throw new ForbiddenException("You cannot delete your own account");
    }
    const user = await this.findOneOrFail(id);
    try {
      await this.usersRepo.softRemoveScoped(user, actingUserId);
      this.logger.debug(`remove succeeded for user ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: actingUserId,
        changes: { username: user.username, displayName: user.displayName },
      });
    } catch (err) {
      this.logger.error(`remove failed for user ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async assertUsernameAvailable(username: string): Promise<void> {
    const existing = await this.usersRepo.findOneScoped({ where: { username } });
    if (existing) {
      throw new ConflictException(`Username "${username}" is already in use`);
    }
  }
}
