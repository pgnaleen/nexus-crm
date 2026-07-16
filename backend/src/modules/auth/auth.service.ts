import { createHash, randomBytes } from "node:crypto";
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

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

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
    const tenant = await this.tenantRepo.findOneBy({ slug: dto.tenantSlug });
    if (!tenant) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const user = await this.userRepo.findOneBy({ tenantId: tenant.id, username: dto.username });
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Too many failed attempts. Try again in a few minutes.");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      user.loggingAttempts += 1;
      if (user.loggingAttempts >= LOGIN_LOCKOUT_THRESHOLD) {
        user.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS);
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException("Invalid credentials");
    }

    user.loggingAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoggingAt = new Date();
    await this.userRepo.save(user);

    return this.issueSession(user, tenant);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<{ session: AuthSessionResponse } & TokenPair> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existing = await this.refreshTokenRepo.findOneBy({ tokenHash });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    existing.revokedAt = new Date();
    await this.refreshTokenRepo.save(existing);

    const [user, tenant] = await Promise.all([
      this.userRepo.findOneByOrFail({ id: existing.userId }),
      this.tenantRepo.findOneByOrFail({ id: existing.tenantId }),
    ]);

    return this.issueSession(user, tenant);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
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
    if (!(await this.systemTenantCache.isSystemTenant(callerRealTenantId))) {
      throw new ForbiddenException("Only the System tenant can act as another tenant");
    }

    const tenant = await this.tenantRepo.findOneBy({ id: targetTenantId });
    if (!tenant) {
      throw new NotFoundException("Target tenant not found");
    }

    const payload: ActAsTenantTokenPayload = {
      typ: ACT_AS_TENANT_TOKEN_TYPE,
      actAsTenantId: tenant.id,
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
  }

  async getSession(userId: string): Promise<AuthSessionResponse> {
    const user = await this.userRepo.findOneByOrFail({ id: userId });
    const tenant = await this.tenantRepo.findOneByOrFail({ id: user.tenantId });
    const [roles, permissions, actingTenant] = await Promise.all([
      this.rbacService.getRoleNamesForUser(user.id),
      this.rbacService.getPermissionsForUser(user.id),
      this.resolveActingTenant(user.tenantId),
    ]);
    return this.toSession(user, tenant, roles, permissions, actingTenant);
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
    const tenant = await this.tenantRepo.findOneBy({ id: ambientTenantId });
    if (!tenant) {
      return null;
    }
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }

  private async issueSession(user: User, tenant: Tenant): Promise<{ session: AuthSessionResponse } & TokenPair> {
    const [roles, permissions] = await Promise.all([
      this.rbacService.getRoleNamesForUser(user.id),
      this.rbacService.getPermissionsForUser(user.id),
    ]);

    const payload: AuthenticatedUser = { sub: user.id, tenantId: tenant.id, roles };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN"),
    });

    const refreshToken = randomBytes(48).toString("hex");
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN")!;
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tenantId: tenant.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + parseDurationToMs(refreshExpiresIn)),
      }),
    );

    // Login/refresh always issue a session for the caller's real tenant --
    // act-as-tenant is a separate cookie established afterward, never active here.
    return { session: this.toSession(user, tenant, roles, permissions, null), accessToken, refreshToken };
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

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
