import { ActingTenant, AuthSessionResponse, PERMISSIONS, VerifyPasswordResponse } from "@orelia/common";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ACT_AS_TENANT_COOKIE, ACT_AS_TENANT_TTL_MS } from "../../core/tenant";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { ACCESS_COOKIE, ACCESS_MAX_AGE_MS, REFRESH_COOKIE, REFRESH_MAX_AGE_MS } from "./auth.constants";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { ActAsTenantDto } from "./dto/act-as-tenant.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyPasswordDto } from "./dto/verify-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedUser } from "./types/authenticated-user";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponse> {
    // Never log dto.password.
    this.logger.debug(`POST /auth/login called (tenantSlug="${dto.tenantSlug}", username="${dto.username}")`);
    try {
      const requestMeta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
      const { session, accessToken, refreshToken } = await this.authService.login(dto, requestMeta);
      this.setAuthCookies(res, accessToken, refreshToken);
      this.logger.debug(`POST /auth/login succeeded for user ${session.user.id}`);
      return session;
    } catch (err) {
      this.logger.error(`POST /auth/login failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponse> {
    this.logger.debug("POST /auth/refresh called");
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      const { session, accessToken, refreshToken: newRefreshToken } =
        await this.authService.refresh(refreshToken);
      this.setAuthCookies(res, accessToken, newRefreshToken);
      this.logger.debug(`POST /auth/refresh succeeded for user ${session.user.id}`);
      return session;
    } catch (err) {
      // A missing/invalid/expired refresh token is the expected outcome for
      // a logged-out or already-expired session (apiFetch's 401-retry logic
      // calls this route speculatively on every 401), not a system error --
      // same treatment this codebase already gives NotFoundException/
      // ConflictException elsewhere. Still always rethrown, never swallowed.
      if (err instanceof UnauthorizedException) {
        this.logger.debug(`POST /auth/refresh rejected: ${(err as Error).message}`);
      } else {
        this.logger.error(`POST /auth/refresh failed: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Public, not JwtAuthGuard-gated: logout must succeed even when the access
  // token has already expired (the single most common time someone clicks
  // it) -- it only needs the refresh-token cookie, which AuthService.logout
  // already handles gracefully if missing/stale. Gating this on a valid
  // access token meant an expired-but-present one blocked the whole request
  // with 401 before cookies ever got cleared, leaving a dead session's
  // cookies stuck in the browser.
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.logger.debug("POST /auth/logout called");
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      const requestMeta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
      await this.authService.logout(refreshToken, requestMeta);
      res.clearCookie(ACCESS_COOKIE);
      res.clearCookie(REFRESH_COOKIE);
      // Defense in depth for shared machines -- a mismatched actingUserId
      // already makes a stale act-as cookie harmless for a different
      // subsequent login, but clearing it explicitly removes the ambiguity.
      res.clearCookie(ACT_AS_TENANT_COOKIE);
      this.logger.debug("POST /auth/logout succeeded");
    } catch (err) {
      this.logger.error(`POST /auth/logout failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthSessionResponse> {
    this.logger.debug(`GET /auth/me called for user ${user.sub}`);
    try {
      const session = await this.authService.getSession(user.sub);
      this.logger.debug(`GET /auth/me succeeded for user ${user.sub}`);
      return session;
    } catch (err) {
      this.logger.error(`GET /auth/me failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Confirms the caller's OWN current password -- no permission check beyond
  // being logged in, since every user needs this for cascade-delete
  // confirmations regardless of what resource permissions they hold.
  @UseGuards(JwtAuthGuard)
  @Post("verify-password")
  @HttpCode(HttpStatus.OK)
  async verifyPassword(
    @Body() dto: VerifyPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VerifyPasswordResponse> {
    // Never log dto.password.
    this.logger.debug(`POST /auth/verify-password called for user ${user.sub}`);
    try {
      const valid = await this.authService.verifyPassword(user.sub, dto.password);
      this.logger.debug(`POST /auth/verify-password result for user ${user.sub}: ${valid ? "valid" : "invalid"}`);
      return { valid };
    } catch (err) {
      this.logger.error(`POST /auth/verify-password failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.PLATFORM_IMPERSONATE_TENANT)
  @Post("act-as-tenant")
  @HttpCode(HttpStatus.OK)
  async actAsTenant(
    @Body() dto: ActAsTenantDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ tenant: ActingTenant }> {
    this.logger.debug(`POST /auth/act-as-tenant called by ${user.sub} targeting tenant ${dto.tenantId}`);
    try {
      // user.tenantId here is the REAL tenant from the verified main JWT, not
      // the ambient (possibly already-impersonated) TenantContextService --
      // deliberately, so this can't be chained/compounded.
      const { token, tenant } = await this.authService.actAsTenant(user.sub, user.tenantId, dto.tenantId);

      res.cookie(ACT_AS_TENANT_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ACT_AS_TENANT_TTL_MS,
      });

      this.logger.debug(`POST /auth/act-as-tenant succeeded, now acting as tenant ${tenant.id}`);
      return { tenant };
    } catch (err) {
      this.logger.error(`POST /auth/act-as-tenant failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post("exit-act-as-tenant")
  @HttpCode(HttpStatus.NO_CONTENT)
  async exitActAsTenant(@Res({ passthrough: true }) res: Response): Promise<void> {
    this.logger.debug("POST /auth/exit-act-as-tenant called");
    res.clearCookie(ACT_AS_TENANT_COOKIE);
    this.logger.debug("POST /auth/exit-act-as-tenant succeeded");
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const secure = process.env.NODE_ENV === "production";

    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: ACCESS_MAX_AGE_MS,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      // Path scoped to "/api/auth" originally, but that means the browser
      // never attaches it to page-path requests — which is exactly what the
      // frontend's middleware needs to read in order to proactively refresh
      // an expiring access token during normal navigation. httpOnly still
      // keeps it unreadable to JS regardless of Path scope.
      path: "/",
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }
}
