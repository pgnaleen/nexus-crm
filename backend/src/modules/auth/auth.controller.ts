import { AuthSessionResponse } from "@orelia/common";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
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
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthSessionResponse> {
    return this.authService.getSession(user.sub);
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
      path: "/api/auth",
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }
}
