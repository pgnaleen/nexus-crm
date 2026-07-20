import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { UploadsController } from "./uploads.controller";

@Module({
  imports: [RbacModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
