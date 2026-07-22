import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { PERMISSIONS, UploadResponse } from "@orelia/common";
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { diskStorage } from "multer";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import {
  ALLOWED_LOGO_MIME_TYPES,
  LOGO_SUBDIR,
  MAX_LOGO_SIZE_BYTES,
  UPLOAD_DIR,
} from "./uploads.constants";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

const logoDir = join(process.cwd(), UPLOAD_DIR, LOGO_SUBDIR);

@Controller("uploads")
export class UploadsController {
  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Post("logo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          if (!existsSync(logoDir)) {
            mkdirSync(logoDir, { recursive: true });
          }
          callback(null, logoDir);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const ext = file.originalname.split(".").pop();
          callback(null, `${randomUUID()}.${ext}`);
        },
      }),
      limits: { fileSize: MAX_LOGO_SIZE_BYTES },
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException("Logo must be a PNG, JPEG, WebP, or SVG image"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File): UploadResponse {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return { url: `/uploads/${LOGO_SUBDIR}/${file.filename}` };
  }
}
