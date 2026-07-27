import { randomUUID } from "crypto";
import { PERMISSIONS, UploadResponse } from "@orelia/common";
import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { S3Service } from "../../core/storage/s3.service";
import {
  CERTIFICATION_PREFIX,
  EMPLOYEE_CV_PREFIX,
  EMPLOYEE_PHOTO_PREFIX,
  LOGO_PREFIX,
  tenantKeyPrefix,
} from "../../core/storage/storage.constants";
import { TenantContextService } from "../../core/tenant";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import {
  ALLOWED_CERTIFICATION_MIME_TYPES,
  ALLOWED_EMPLOYEE_CV_MIME_TYPES,
  ALLOWED_EMPLOYEE_PHOTO_MIME_TYPES,
  ALLOWED_LOGO_MIME_TYPES,
  MAX_CERTIFICATION_SIZE_BYTES,
  MAX_EMPLOYEE_CV_SIZE_BYTES,
  MAX_EMPLOYEE_PHOTO_SIZE_BYTES,
  MAX_LOGO_SIZE_BYTES,
} from "./uploads.constants";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

function fileExt(originalname: string): string {
  return originalname.split(".").pop() ?? "bin";
}

@Controller("uploads")
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private readonly s3: S3Service,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async uploadAndRespond(file: Express.Multer.File, prefix: string): Promise<UploadResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const key = `${tenantKeyPrefix(prefix, tenantId)}${randomUUID()}.${fileExt(file.originalname)}`;
    this.logger.debug(`uploadAndRespond: putting object at ${key} (${file.size} bytes, ${file.mimetype})`);
    await this.s3.putObject(key, file.buffer, file.mimetype);
    const previewUrl = await this.s3.getSignedGetUrl(key);
    if (!previewUrl) {
      // Only reachable if S3 is disabled after putObject just succeeded above
      // (requireEnabled() would already have thrown) -- treated as a
      // genuine failure since the caller needs a preview URL to show the
      // file it just uploaded.
      throw new BadRequestException("Uploaded, but failed to generate a preview URL");
    }
    this.logger.debug(`uploadAndRespond: succeeded for ${key}`);
    return { key, previewUrl };
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Post("logo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
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
  async uploadLogo(@UploadedFile() file: Express.Multer.File): Promise<UploadResponse> {
    this.logger.debug(`POST /uploads/logo called (file=${file?.originalname ?? "none"})`);
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    try {
      const result = await this.uploadAndRespond(file, LOGO_PREFIX);
      this.logger.debug(`POST /uploads/logo succeeded`);
      return result;
    } catch (err) {
      this.logger.error(`POST /uploads/logo failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Stories 1.2/1.4 (Create/Update Employee) -- Personal tab's profile
  // photo, uploadable from either the create or the edit form.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_CREATE, PERMISSIONS.EMPLOYEES_UPDATE])
  @Post("employee-photo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EMPLOYEE_PHOTO_SIZE_BYTES },
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!ALLOWED_EMPLOYEE_PHOTO_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException("Profile photo must be a PNG, JPEG, or WebP image"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadEmployeePhoto(@UploadedFile() file: Express.Multer.File): Promise<UploadResponse> {
    this.logger.debug(`POST /uploads/employee-photo called (file=${file?.originalname ?? "none"})`);
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    try {
      const result = await this.uploadAndRespond(file, EMPLOYEE_PHOTO_PREFIX);
      this.logger.debug(`POST /uploads/employee-photo succeeded`);
      return result;
    } catch (err) {
      this.logger.error(`POST /uploads/employee-photo failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Stories 1.2/1.4 (Create/Update Employee) -- Employment tab's CV upload,
  // uploadable from either the create or the edit form.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_CREATE, PERMISSIONS.EMPLOYEES_UPDATE])
  @Post("employee-cv")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EMPLOYEE_CV_SIZE_BYTES },
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!ALLOWED_EMPLOYEE_CV_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException("CV must be a PDF or Word document"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadEmployeeCv(@UploadedFile() file: Express.Multer.File): Promise<UploadResponse> {
    this.logger.debug(`POST /uploads/employee-cv called (file=${file?.originalname ?? "none"})`);
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    try {
      const result = await this.uploadAndRespond(file, EMPLOYEE_CV_PREFIX);
      this.logger.debug(`POST /uploads/employee-cv succeeded`);
      return result;
    } catch (err) {
      this.logger.error(`POST /uploads/employee-cv failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.12 (Self-Report a Certification) -- evidence file for a
  // certification claim. Auth-only (no RequirePermission): any employee
  // uploads their own evidence from My Profile, same self-service posture as
  // the certifications routes themselves. The global JwtAuthGuard still
  // applies -- never reachable unauthenticated.
  @Post("certification")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_CERTIFICATION_SIZE_BYTES },
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!ALLOWED_CERTIFICATION_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException("Certificate must be a PDF or an image (PNG, JPEG, WebP)"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadCertification(@UploadedFile() file: Express.Multer.File): Promise<UploadResponse> {
    this.logger.debug(`POST /uploads/certification called (file=${file?.originalname ?? "none"})`);
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    try {
      const result = await this.uploadAndRespond(file, CERTIFICATION_PREFIX);
      this.logger.debug(`POST /uploads/certification succeeded`);
      return result;
    } catch (err) {
      this.logger.error(`POST /uploads/certification failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
