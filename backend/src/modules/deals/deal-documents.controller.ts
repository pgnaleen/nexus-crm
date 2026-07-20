import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { DealDocumentResponse, PERMISSIONS } from "@orelia/common";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { diskStorage } from "multer";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import {
  ALLOWED_DEAL_DOCUMENT_MIME_TYPES,
  DEAL_DOCUMENTS_SUBDIR,
  MAX_DEAL_DOCUMENT_SIZE_BYTES,
  UPLOAD_DIR,
} from "../uploads/uploads.constants";
import { CreateDealDocumentDto } from "./dto/create-deal-document.dto";
import { DealDocument } from "./entities/deal-document.entity";
import { DealDocumentsService } from "./deal-documents.service";

const documentsDir = join(process.cwd(), UPLOAD_DIR, DEAL_DOCUMENTS_SUBDIR);

@Controller("deals/:dealId/documents")
export class DealDocumentsController {
  constructor(private readonly dealDocumentsService: DealDocumentsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_READ])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealDocumentResponse[]> {
    const documents = await this.dealDocumentsService.findAll(dealId);
    return documents.map((doc) => this.toResponse(doc));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          if (!existsSync(documentsDir)) {
            mkdirSync(documentsDir, { recursive: true });
          }
          callback(null, documentsDir);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const ext = file.originalname.split(".").pop();
          callback(null, `${randomUUID()}.${ext}`);
        },
      }),
      limits: { fileSize: MAX_DEAL_DOCUMENT_SIZE_BYTES },
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!ALLOWED_DEAL_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException("Unsupported document type"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDealDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealDocumentResponse> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    const s3Key = `/uploads/${DEAL_DOCUMENTS_SUBDIR}/${file.filename}`;
    const document = await this.dealDocumentsService.create(dealId, dto, s3Key, user.sub);
    return this.toResponse(document);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Delete(":documentId")
  async remove(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ): Promise<{ success: true }> {
    await this.dealDocumentsService.remove(dealId, documentId);
    return { success: true };
  }

  private toResponse(document: DealDocument): DealDocumentResponse {
    return {
      id: document.id,
      dealId: document.dealId,
      docType: document.docType,
      title: document.title,
      url: document.s3Key,
      createdAt: document.createdAt.toISOString(),
    };
  }
}
