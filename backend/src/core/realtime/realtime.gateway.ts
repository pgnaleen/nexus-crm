import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ACCESS_COOKIE } from "../../modules/auth/auth.constants";
import type { AuthenticatedUser } from "../../modules/auth/types/authenticated-user";
import { tenantUserRoom } from "./realtime.constants";

// Epic 3, Story 3.4 -- the app's first WebSocket gateway. No `@nestjs/
// passport` guard runs on a socket connection the way JwtAuthGuard runs on
// every HTTP request, so authentication happens by hand here, once, on
// connect -- the same JWT_ACCESS_SECRET-signed token, verified with the same
// JwtService the rest of the app already uses (AuthService/
// TenantContextInterceptor), not a parallel auth scheme. A socket that fails
// this is disconnected immediately; nothing it sends is ever trusted.
//
// CORS mirrors main.ts's own CORS_ORIGIN allow-list exactly -- this is the
// same "credentials:true needs an explicit origin, never a wildcard"
// constraint the HTTP server already applies (main.ts's own comment on why).
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((origin) => origin.trim()),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error("No access token on handshake");
      }
      const user = this.jwtService.verify<AuthenticatedUser>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
      client.data.user = user;
      const room = tenantUserRoom(user.tenantId, user.sub);
      client.join(room);
      this.logger.debug(`Socket ${client.id} authenticated as user ${user.sub}, joined ${room}`);
    } catch (err) {
      this.logger.debug(`Socket ${client.id} failed handshake auth: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  // The access-token cookie is httpOnly + sameSite:lax (auth.controller.ts's
  // setAuthCookies) -- the browser attaches it to the WS handshake's
  // underlying HTTP request automatically as long as the client connects
  // with `withCredentials: true`, exactly like every existing apiFetch call
  // already relies on for ordinary requests. `auth.token` is a fallback for
  // any client that can't rely on that (there is none today; kept cheap and
  // harmless to support).
  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;
    const prefix = `${ACCESS_COOKIE}=`;
    const match = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
  }
}
