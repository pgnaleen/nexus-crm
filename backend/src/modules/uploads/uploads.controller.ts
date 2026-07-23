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
  ALLOWED_EMPLOYEE_CV_MIME_TYPES,
  ALLOWED_EMPLOYEE_PHOTO_MIME_TYPES,
  ALLOWED_LOGO_MIME_TYPES,
  EMPLOYEE_CV_SUBDIR,
  EMPLOYEE_PHOTO_SUBDIR,
  LOGO_SUBDIR,
  MAX_EMPLOYEE_CV_SIZE_BYTES,
  MAX_EMPLOYEE_PHOTO_SIZE_BYTES,
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
const employeePhotoDir = join(process.cwd(), UPLOAD_DIR, EMPLOYEE_PHOTO_SUBDIR);
const employeeCvDir = join(process.cwd(), UPLOAD_DIR, EMPLOYEE_CV_SUBDIR);

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

@Controller("uploads")
export class UploadsController {
  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Post("logo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          ensureDir(logoDir);
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

  // Story 1.2 (Create Employee) -- Personal tab's profile photo. Gated on
  // EMPLOYEES_CREATE only for now; broaden to include EMPLOYEES_UPDATE once
  // Update Employee (Story 1.4) exists and can also change this field.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_CREATE])
  @Post("employee-photo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          ensureDir(employeePhotoDir);
          callback(null, employeePhotoDir);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const ext = file.originalname.split(".").pop();
          callback(null, `${randomUUID()}.${ext}`);
        },
      }),
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
  uploadEmployeePhoto(@UploadedFile() file: Express.Multer.File): UploadResponse {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return { url: `/uploads/${EMPLOYEE_PHOTO_SUBDIR}/${file.filename}` };
  }

  // Story 1.2 (Create Employee) -- Employment tab's CV upload.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_CREATE])
  @Post("employee-cv")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          ensureDir(employeeCvDir);
          callback(null, employeeCvDir);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const ext = file.originalname.split(".").pop();
          callback(null, `${randomUUID()}.${ext}`);
        },
      }),
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
  uploadEmployeeCv(@UploadedFile() file: Express.Multer.File): UploadResponse {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return { url: `/uploads/${EMPLOYEE_CV_SUBDIR}/${file.filename}` };
  }
}
