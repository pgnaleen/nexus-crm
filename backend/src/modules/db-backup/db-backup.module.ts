import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { DbBackupController } from "./db-backup.controller";
import { DbBackupService } from "./db-backup.service";

// S3Service is registered globally by CoreModule (shared with the uploads
// feature, same bucket, distinct key prefixes -- see storage.constants.ts),
// so it isn't listed as a local provider here anymore.
@Module({
  imports: [RbacModule],
  controllers: [DbBackupController],
  providers: [DbBackupService],
})
export class DbBackupModule {}
