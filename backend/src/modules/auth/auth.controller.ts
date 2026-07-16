import { ActingTenant, AuthSessionResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { ACT_AS_TENANT_COOKIE, ACT_AS_TENANT_TTL_MS } from "../../core/tenant";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { ActAsTenantDto } from "./dto/act-as-tenant.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedUser } from "./types/authenticated-user";

const ACCESS_COOKIE = "orelia_access_token";
const REFRESH_COOKIE = "orelia_refresh_token";
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponse> {
    const { session, accessToken, refreshToken } = await this.authService.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return session;
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponse> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    const { session, accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken);
    return session;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    await this.authService.logout(refreshToken);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE);
    // Defense in depth for shared machines -- a mismatched actingUserId
    // already makes a stale act-as cookie harmless for a different
    // subsequent login, but clearing it explicitly removes the ambiguity.
    res.clearCookie(ACT_AS_TENANT_COOKIE);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthSessionResponse> {
    return this.authService.getSession(user.sub);
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

    return { tenant };
  }

  @UseGuards(JwtAuthGuard)
  @Post("exit-act-as-tenant")
  @HttpCode(HttpStatus.NO_CONTENT)
  async exitActAsTenant(@Res({ passthrough: true }) res: Response): Promise<void> {
    res.clearCookie(ACT_AS_TENANT_COOKIE);
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
