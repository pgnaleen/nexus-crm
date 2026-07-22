import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { DbBackupController } from "./db-backup.controller";
import { DbBackupService } from "./db-backup.service";
import { S3Service } from "./s3.service";

@Module({
  imports: [RbacModule],
  controllers: [DbBackupController],
  providers: [DbBackupService, S3Service],
})
export class DbBackupModule {}
