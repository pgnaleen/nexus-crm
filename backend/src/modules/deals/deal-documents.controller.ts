import { randomUUID } from "crypto";
import { DealDocumentResponse, PERMISSIONS } from "@orelia/common";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { S3Service } from "../../core/storage/s3.service";
import { DEAL_DOCUMENTS_PREFIX } from "../../core/storage/storage.constants";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { ALLOWED_DEAL_DOCUMENT_MIME_TYPES, MAX_DEAL_DOCUMENT_SIZE_BYTES } from "../uploads/uploads.constants";
import { CreateDealDocumentDto } from "./dto/create-deal-document.dto";
import { DealDocument } from "./entities/deal-document.entity";
import { DealDocumentsService } from "./deal-documents.service";

@Controller("deals/:dealId/documents")
export class DealDocumentsController {
  private readonly logger = new Logger(DealDocumentsController.name);

  constructor(
    private readonly dealDocumentsService: DealDocumentsService,
    private readonly s3: S3Service,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealDocumentResponse[]> {
    this.logger.debug(`GET /deals/${dealId}/documents called`);
    try {
      const documents = await this.dealDocumentsService.findAll(dealId);
      const responses = await Promise.all(documents.map((doc) => this.toResponse(doc)));
      this.logger.debug(`GET /deals/${dealId}/documents returning ${responses.length} row(s)`);
      return responses;
    } catch (err) {
      this.logger.error(`GET /deals/${dealId}/documents failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
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
    this.logger.debug(`POST /deals/${dealId}/documents called by ${user.sub} (file=${file?.originalname ?? "none"}, docType=${dto?.docType})`);
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    try {
      const ext = file.originalname.split(".").pop() ?? "bin";
      const s3Key = `${DEAL_DOCUMENTS_PREFIX}${dealId}/${randomUUID()}.${ext}`;
      await this.s3.putObject(s3Key, file.buffer, file.mimetype);
      const document = await this.dealDocumentsService.create(dealId, dto, s3Key, user.sub);
      const response = await this.toResponse(document);
      this.logger.debug(`POST /deals/${dealId}/documents succeeded, document ${document.id}`);
      return response;
    } catch (err) {
      this.logger.error(`POST /deals/${dealId}/documents failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Delete(":documentId")
  async remove(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /deals/${dealId}/documents/${documentId} called by ${user.sub}`);
    try {
      await this.dealDocumentsService.remove(dealId, documentId, user.sub);
      this.logger.debug(`DELETE /deals/${dealId}/documents/${documentId} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /deals/${dealId}/documents/${documentId} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async toResponse(document: DealDocument): Promise<DealDocumentResponse> {
    return {
      id: document.id,
      dealId: document.dealId,
      docType: document.docType,
      title: document.title,
      // A fresh signed URL, generated on every response -- the row itself
      // only ever stores the bare S3 key (document.s3Key).
      url: (await this.s3.getSignedGetUrl(document.s3Key)) ?? "",
      createdAt: document.createdAt.toISOString(),
    };
  }
}
