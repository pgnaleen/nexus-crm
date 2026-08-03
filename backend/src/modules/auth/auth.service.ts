import { randomBytes } from "node:crypto";
import { ActingTenant, AuthSessionResponse, UserStatus } from "@orelia/common";
import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import {
  ACT_AS_TENANT_TOKEN_TYPE,
  ACT_AS_TENANT_TTL_MS,
  ActAsTenantTokenPayload,
  SystemTenantCache,
  TenantContextService,
} from "../../core/tenant";
import { RbacService } from "../rbac/rbac.service";
import { Tenant } from "../tenants/entities/tenant.entity";
import { RefreshToken } from "../users/entities/refresh-token.entity";
import { User } from "../users/entities/user.entity";
import { LoginDto } from "./dto/login.dto";
import type { AuthenticatedUser } from "./types/authenticated-user";
import { parseDurationToMs } from "./util/duration";
import { hashToken } from "./util/token-hash";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// Fix A grace window -- see plan-auth-cross-tab-session-sync.md.
const REFRESH_GRACE_WINDOW_MS = 10 * 1000;

@Injectable()
export class AuthService {
  constructor(
    // Auth resolves the tenant explicitly from the login payload, before any
    // session/tenant context exists — the one legitimate place raw repositories
    // are used instead of BaseTenantRepository (which requires an established
    // tenant context that doesn't exist yet at login time).
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly rbacService: RbacService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly systemTenantCache: SystemTenantCache,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async login(dto: LoginDto): Promise<{ session: AuthSessionResponse } & TokenPair> {
    // Never log dto.password.
    this.logger.debug(`login called (tenantSlug="${dto.tenantSlug}", username="${dto.username}")`);
    try {
      const tenant = await this.tenantRepo.findOneBy({ slug: dto.tenantSlug });
      if (!tenant) {
        this.logger.debug(`login blocked: no tenant with slug "${dto.tenantSlug}"`);
        throw new UnauthorizedException("Invalid credentials");
      }

      const user = await this.userRepo.findOneBy({ tenantId: tenant.id, username: dto.username });
      if (!user || user.status !== UserStatus.Active) {
        this.logger.debug(`login blocked: user "${dto.username}" not found or not active for tenant ${tenant.id}`);
        throw new UnauthorizedException("Invalid credentials");
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        this.logger.debug(`login blocked: user ${user.id} is locked out until ${user.lockedUntil.toISOString()}`);
        throw new UnauthorizedException("Too many failed attempts. Try again in a few minutes.");
      }

      const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
      if (!passwordMatches) {
        user.loggingAttempts += 1;
        if (user.loggingAttempts >= LOGIN_LOCKOUT_THRESHOLD) {
          user.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS);
          this.logger.debug(`login: user ${user.id} hit the lockout threshold, locking until ${user.lockedUntil.toISOString()}`);
        } else {
          this.logger.debug(`login blocked: wrong password for user ${user.id} (attempt ${user.loggingAttempts}/${LOGIN_LOCKOUT_THRESHOLD})`);
        }
        await this.userRepo.save(user);
        throw new UnauthorizedException("Invalid credentials");
      }

      user.loggingAttempts = 0;
      // Explicit null, not undefined -- TypeORM's save() silently skips a
      // column when the property is undefined, so this previously left a
      // stale lockedUntil in the DB after every successful post-lockout
      // login. Harmless in practice (the login check is a time comparison,
      // so an expired timestamp is already ignored either way), but real
      // stale data -- see user.entity.ts's comment on this column.
      user.lockedUntil = null;
      user.lastLoggingAt = new Date();
      await this.userRepo.save(user);
      this.logger.debug(`login succeeded for user ${user.id}`);

      return await this.issueSession(user, tenant);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`login failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  /**
   * Confirms the currently-authenticated user's own password, without
   * issuing new tokens -- used to gate cascade-delete confirmations (see
   * CLAUDE.md's cascade-delete rule), not as a login/session mechanism.
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    this.logger.debug(`verifyPassword called for user ${userId}`);
    try {
      const user = await this.userRepo.findOneByOrFail({ id: userId });
      const matches = await bcrypt.compare(password, user.passwordHash);
      this.logger.debug(`verifyPassword result for user ${userId}: ${matches ? "match" : "no match"}`);
      return matches;
    } catch (err) {
      this.logger.error(`verifyPassword failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async refresh(rawRefreshToken: string | undefined): Promise<{ session: AuthSessionResponse } & TokenPair> {
    // Never log the raw token -- only its presence/absence and the hash.
    this.logger.debug(`refresh called (tokenProvided=${!!rawRefreshToken})`);
    if (!rawRefreshToken) {
      this.logger.debug("refresh blocked: no refresh token cookie present");
      throw new UnauthorizedException("Missing refresh token");
    }

    try {
      const tokenHash = hashToken(rawRefreshToken);
      const existing = await this.refreshTokenRepo.findOneBy({ tokenHash });

      if (!existing) {
        this.logger.debug("refresh blocked: token not found");
        throw new UnauthorizedException("Refresh token is invalid or expired");
      }

      // Grace-window reuse: two callers raced for the same (now-rotated)
      // token -- typically two open tabs, or the proactive middleware
      // refresh landing close to a reactive client/server-side one. Return
      // the identical new pair rather than 401ing the loser of a race that
      // just happened to hit a live session. See plan-auth-cross-tab-session-sync.md.
      if (
        existing.revokedAt &&
        existing.graceToken &&
        existing.graceExpiresAt &&
        existing.graceExpiresAt > new Date()
      ) {
        this.logger.debug(
          `refresh: grace-window reuse (rotated ${Date.now() - existing.revokedAt.getTime()}ms ago) for user ${existing.userId} -- returning cached pair`,
        );
        const [user, tenant] = await Promise.all([
          this.userRepo.findOneByOrFail({ id: existing.userId }),
          this.tenantRepo.findOneByOrFail({ id: existing.tenantId }),
        ]);
        const { accessToken, session } = await this.signAccessToken(user, tenant);
        return { session, accessToken, refreshToken: existing.graceToken };
      }

      if (existing.revokedAt || existing.expiresAt < new Date()) {
        this.logger.debug(
          `refresh blocked: token ${existing.revokedAt ? "already revoked (outside grace window)" : "expired"}`,
        );
        throw new UnauthorizedException("Refresh token is invalid or expired");
      }

      existing.revokedAt = new Date();
      await this.refreshTokenRepo.save(existing);

      const [user, tenant] = await Promise.all([
        this.userRepo.findOneByOrFail({ id: existing.userId }),
        this.tenantRepo.findOneByOrFail({ id: existing.tenantId }),
      ]);

      this.logger.debug(`refresh succeeded for user ${user.id}, rotating refresh token`);
      const result = await this.issueSession(user, tenant);

      // Cache the new raw token on the now-revoked row for
      // REFRESH_GRACE_WINDOW_MS -- see the grace-window check above.
      existing.graceToken = result.refreshToken;
      existing.graceExpiresAt = new Date(existing.revokedAt.getTime() + REFRESH_GRACE_WINDOW_MS);
      await this.refreshTokenRepo.save(existing);

      return result;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`refresh failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    this.logger.debug(`logout called (tokenProvided=${!!rawRefreshToken})`);
    if (!rawRefreshToken) {
      this.logger.debug("logout: no refresh token cookie present, nothing to revoke");
      return;
    }
    try {
      const tokenHash = hashToken(rawRefreshToken);
      const result = await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
      this.logger.debug(`logout succeeded, revoked ${result.affected ?? 0} token row(s)`);
    } catch (err) {
      this.logger.error(`logout failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  /**
   * Issues a short-lived signed "act as tenant" token. `callerRealTenantId`
   * must come from the caller's verified main JWT (@CurrentUser()), never
   * from the ambient TenantContextService -- checking the real identity
   * here, not whatever tenant is currently ambient, is what stops this from
   * being chainable/compounded if ever called while already impersonating.
   */
  async actAsTenant(
    actingUserId: string,
    callerRealTenantId: string,
    targetTenantId: string,
  ): Promise<{ token: string; tenant: ActingTenant }> {
    this.logger.debug(`actAsTenant called by ${actingUserId} (real tenant ${callerRealTenantId}) targeting tenant ${targetTenantId}`);
    try {
      if (!(await this.systemTenantCache.isSystemTenant(callerRealTenantId))) {
        this.logger.debug(`actAsTenant blocked: caller's real tenant ${callerRealTenantId} is not the System tenant`);
        throw new ForbiddenException("Only the System tenant can act as another tenant");
      }

      const tenant = await this.tenantRepo.findOneBy({ id: targetTenantId });
      if (!tenant) {
        this.logger.debug(`actAsTenant blocked: target tenant ${targetTenantId} not found`);
        throw new NotFoundException("Target tenant not found");
      }

      const payload: ActAsTenantTokenPayload = {
        typ: ACT_AS_TENANT_TOKEN_TYPE,
        actAsTenantId: tenant.id,
        actAsTenantSlug: tenant.slug,
        actingUserId,
      };
      const token = this.jwtService.sign(payload, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: ACT_AS_TENANT_TTL_MS / 1000,
      });

      this.logger.log(
        `User ${actingUserId} (tenant ${callerRealTenantId}) began acting as tenant ${tenant.id} (${tenant.slug})`,
      );

      return { token, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`actAsTenant failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async getSession(userId: string): Promise<AuthSessionResponse> {
    this.logger.debug(`getSession called for user ${userId}`);
    try {
      const user = await this.userRepo.findOneByOrFail({ id: userId });
      const tenant = await this.tenantRepo.findOneByOrFail({ id: user.tenantId });
      const [roles, permissions, actingTenant] = await Promise.all([
        this.rbacService.getRoleNamesForUser(user.id),
        this.rbacService.getPermissionsForUser(user.id),
        this.resolveActingTenant(user.tenantId),
      ]);
      this.logger.debug(`getSession succeeded for user ${userId} (${roles.length} role(s), ${permissions.length} permission(s))`);
      return this.toSession(user, tenant, roles, permissions, actingTenant);
    } catch (err) {
      this.logger.error(`getSession failed for user ${userId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  /**
   * The ambient tenant (TenantContextService) reflects act-as-tenant when
   * active; the user's own `tenantId` never does. When they differ, surface
   * the impersonated tenant separately so the UI can show "acting as X"
   * without ever changing what `tenant` means elsewhere in the session.
   */
  private async resolveActingTenant(realTenantId: string): Promise<ActingTenant | null> {
    const ambientTenantId = this.tenantContext.getTenantId();
    if (ambientTenantId === realTenantId) {
      return null;
    }
    this.logger.debug(`resolveActingTenant: ambient tenant ${ambientTenantId} differs from real tenant ${realTenantId}`);
    const tenant = await this.tenantRepo.findOneBy({ id: ambientTenantId });
    if (!tenant) {
      return null;
    }
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }

  // Shared by issueSession() and refresh()'s grace-window reuse path (which
  // needs a fresh access token + session but must NOT mint another refresh
  // token -- it returns the already-cached graceToken verbatim instead).
  private async signAccessToken(
    user: User,
    tenant: Tenant,
  ): Promise<{ accessToken: string; session: AuthSessionResponse }> {
    const [roles, permissions] = await Promise.all([
      this.rbacService.getRoleNamesForUser(user.id),
      this.rbacService.getPermissionsForUser(user.id),
    ]);

    const payload: AuthenticatedUser = { sub: user.id, tenantId: tenant.id, tenantSlug: tenant.slug, roles };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN"),
    });

    // Login/refresh always issue a session for the caller's real tenant --
    // act-as-tenant is a separate cookie established afterward, never active here.
    return { accessToken, session: this.toSession(user, tenant, roles, permissions, null) };
  }

  private async issueSession(user: User, tenant: Tenant): Promise<{ session: AuthSessionResponse } & TokenPair> {
    const { accessToken, session } = await this.signAccessToken(user, tenant);

    const refreshToken = randomBytes(48).toString("hex");
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN")!;
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tenantId: tenant.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + parseDurationToMs(refreshExpiresIn)),
      }),
    );
    // Never log accessToken/refreshToken themselves.
    this.logger.debug(`issueSession: minted a new access+refresh token pair for user ${user.id}`);

    return { session, accessToken, refreshToken };
  }

  private toSession(
    user: User,
    tenant: Tenant,
    roles: string[],
    permissions: string[],
    actingTenant: ActingTenant | null,
  ): AuthSessionResponse {
    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        displayName: user.displayName,
        status: user.status,
        loggingEmail: user.loggingEmail,
        lastLoggingAt: user.lastLoggingAt ? user.lastLoggingAt.toISOString() : null,
        mustChangePassword: user.mustChangePassword,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        tagline: tenant.tagline ?? null,
        planId: tenant.planId,
        status: tenant.status,
        industryId: tenant.industryId ?? null,
        phoneNo: tenant.phoneNo ?? null,
        contactEmail: tenant.contactEmail ?? null,
        billingEmail: tenant.billingEmail ?? null,
        address: tenant.address ?? null,
        trialEnds: tenant.trialEnds ?? null,
        notes: tenant.notes ?? null,
      },
      roles,
      permissions,
      actingTenant,
    };
  }
}
