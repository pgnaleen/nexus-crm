import { PERMISSIONS } from "@orelia/common";
import { Controller, HttpCode, HttpException, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { DbBackupService } from "./db-backup.service";

@Controller("db-backup")
export class DbBackupController {
  constructor(private readonly dbBackupService: DbBackupService) {}

  // Synchronous: waits for pg_dump + S3 upload to finish before responding, so
  // the caller knows the dump actually succeeded rather than just "kicked off".
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.BACKUP_CREATE])
  @Post("run")
  @HttpCode(HttpStatus.OK)
  async run(): Promise<{ success: boolean }> {
    const success = await this.dbBackupService.runBackup();
    if (!success) {
      throw new HttpException("S3 is not configured for backups", HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { success };
  }
}
