import { Injectable, Logger } from "@nestjs/common";
import { tenantUserRoom } from "./realtime.constants";
import { RealtimeGateway } from "./realtime.gateway";

// Epic 3, Story 3.4 -- the one place business services reach through to the
// raw Socket.IO server, so nothing outside this module ever touches
// `gateway.server` directly. Single in-process Socket.IO adapter (default,
// no Redis) -- confirmed via docker-compose.yml that the backend runs as one
// instance; revisit if that ever changes.
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser(tenantId: string, userId: string, event: string, payload: unknown): void {
    this.emitToUsers(tenantId, [userId], event, payload);
  }

  emitToUsers(tenantId: string, userIds: string[], event: string, payload: unknown): void {
    if (userIds.length === 0) return;
    this.logger.debug(`Emitting "${event}" to ${userIds.length} user(s) in tenant ${tenantId}`);
    for (const userId of userIds) {
      this.gateway.server.to(tenantUserRoom(tenantId, userId)).emit(event, payload);
    }
  }
}
