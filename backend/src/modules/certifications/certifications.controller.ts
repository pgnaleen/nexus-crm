import { CertifiedEmployeeResponse, CertificationResponse, CertificationReviewResponse, DocumentOwnerType, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { S3Service } from "../../core/storage/s3.service";
import { DocumentsService } from "../documents/documents.service";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CertificationsService } from "./certifications.service";
import { CreateCertificationDto } from "./dto/create-certification.dto";
import { RejectCertificationDto } from "./dto/reject-certification.dto";
import { UpdateCertificationDto } from "./dto/update-certification.dto";
import { EmployeeCertification } from "./entities/employee-certification.entity";

// Story 1.12 -- self-service certifications on My Profile. No
// PermissionsGuard/RequirePermission: the global JwtAuthGuard is the only
// gate. Every route resolves the caller's OWN employee and operates only on
// their own rows -- an ordinary employee (no EMPLOYEES_* permission) manages
// their own certifications, same posture as POST /users/me/change-password
// and GET /employees/me. HR review (verify/reject) is a separate,
// permission-gated surface in Story 1.13.
@Controller("certifications")
export class CertificationsController {
  private readonly logger = new Logger(CertificationsController.name);

  constructor(
    private readonly certificationsService: CertificationsService,
    private readonly documentsService: DocumentsService,
    private readonly s3: S3Service,
  ) {}

  @Get("me")
  async listMine(@CurrentUser() user: AuthenticatedUser): Promise<CertificationResponse[]> {
    this.logger.debug(`GET /certifications/me called by ${user.sub}`);
    try {
      const certifications = await this.certificationsService.listMine(user.sub);
      const responses = await Promise.all(certifications.map((certification) => this.toResponse(certification)));
      this.logger.debug(`GET /certifications/me returning ${responses.length} row(s)`);
      return responses;
    } catch (err) {
      this.logger.error(`GET /certifications/me failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Post("me")
  async createMine(
    @Body() dto: CreateCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificationResponse> {
    this.logger.debug(`POST /certifications/me called by ${user.sub} (name="${dto.name}")`);
    try {
      const created = await this.certificationsService.createMine(user.sub, dto);
      this.logger.debug(`POST /certifications/me succeeded (certification ${created.id})`);
      return this.toResponse(created);
    } catch (err) {
      this.logger.error(`POST /certifications/me failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Patch("me/:id")
  async updateMine(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificationResponse> {
    this.logger.debug(`PATCH /certifications/me/${id} called by ${user.sub}`);
    try {
      const updated = await this.certificationsService.updateMine(user.sub, id, dto);
      this.logger.debug(`PATCH /certifications/me/${id} succeeded`);
      return this.toResponse(updated);
    } catch (err) {
      this.logger.error(`PATCH /certifications/me/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Delete("me/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMine(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    this.logger.debug(`DELETE /certifications/me/${id} called by ${user.sub}`);
    try {
      await this.certificationsService.deleteMine(user.sub, id);
      this.logger.debug(`DELETE /certifications/me/${id} succeeded`);
    } catch (err) {
      this.logger.error(`DELETE /certifications/me/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // ── Story 1.13: HR review queue (EMPLOYEES_VERIFY_CERTIFICATIONS) ──────
  // A distinct capability from EMPLOYEES_UPDATE -- a reviewer can verify/
  // reject without holding general employee-edit rights. "review" is a
  // literal segment; it never collides with the "me/:id" self-service routes.

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS])
  @Get("review")
  async listPending(@CurrentUser() user: AuthenticatedUser): Promise<CertificationReviewResponse[]> {
    this.logger.debug(`GET /certifications/review called by ${user.sub}`);
    try {
      const pending = await this.certificationsService.findPendingForReview();
      const responses = await Promise.all(pending.map((certification) => this.toReviewResponse(certification)));
      this.logger.debug(`GET /certifications/review returning ${responses.length} pending claim(s)`);
      return responses;
    } catch (err) {
      this.logger.error(`GET /certifications/review failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS])
  @Patch(":id/verify")
  async verify(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificationResponse> {
    this.logger.debug(`PATCH /certifications/${id}/verify called by ${user.sub}`);
    try {
      const verified = await this.certificationsService.verify(id, user.sub);
      this.logger.debug(`PATCH /certifications/${id}/verify succeeded`);
      return this.toResponse(verified);
    } catch (err) {
      this.logger.error(`PATCH /certifications/${id}/verify failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS])
  @Patch(":id/reject")
  async reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificationResponse> {
    this.logger.debug(`PATCH /certifications/${id}/reject called by ${user.sub}`);
    try {
      const rejected = await this.certificationsService.reject(id, user.sub, dto.rejectionReason);
      this.logger.debug(`PATCH /certifications/${id}/reject succeeded`);
      return this.toResponse(rejected);
    } catch (err) {
      this.logger.error(`PATCH /certifications/${id}/reject failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.14 -- certified-employee search for project staffing. Gated on
  // EMPLOYEES_VIEW (the broad permission any HR user / manager staffing a
  // project already holds), NOT the verify permission. "search" is a literal
  // segment. An empty query returns [] (the UI prompts to type a name).
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VIEW])
  @Get("search")
  async searchCertified(
    @Query("name") name: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertifiedEmployeeResponse[]> {
    const query = (name ?? "").trim();
    this.logger.debug(`GET /certifications/search called by ${user.sub} (name="${query}")`);
    try {
      if (!query) {
        this.logger.debug("GET /certifications/search: empty query, returning []");
        return [];
      }
      const matches = await this.certificationsService.searchVerifiedByName(query);
      this.logger.debug(`GET /certifications/search returning ${matches.length} match(es)`);
      return matches.map((certification) => this.toCertifiedEmployeeResponse(certification));
    } catch (err) {
      this.logger.error(`GET /certifications/search failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toCertifiedEmployeeResponse(certification: EmployeeCertification): CertifiedEmployeeResponse {
    return {
      certificationId: certification.id,
      employeeId: certification.employeeId,
      employeeName: certification.employee?.fullName ?? "",
      departmentName: certification.employee?.department?.name ?? null,
      name: certification.name,
      issuingOrganization: certification.issuingOrganization,
      issueDate: certification.issueDate,
      expiryDate: certification.expiryDate ?? null,
    };
  }

  private async toReviewResponse(certification: EmployeeCertification): Promise<CertificationReviewResponse> {
    // Evidence file now lives in the shared documents table -- the row
    // itself only ever stores the bare S3 key (evidenceDoc.s3Key).
    const evidenceDoc = await this.documentsService.findCurrentScoped(
      DocumentOwnerType.CertificationEvidence,
      certification.id,
    );
    return {
      id: certification.id,
      employeeId: certification.employeeId,
      employeeName: certification.employee?.fullName ?? "",
      name: certification.name,
      issuingOrganization: certification.issuingOrganization,
      credentialId: certification.credentialId ?? null,
      issueDate: certification.issueDate,
      expiryDate: certification.expiryDate ?? null,
      evidenceFileUrl: evidenceDoc?.s3Key ?? null,
      evidenceFileDisplayUrl: evidenceDoc ? await this.s3.getSignedGetUrl(evidenceDoc.s3Key) : null,
      evidenceLink: certification.evidenceLink ?? null,
      createdAt: certification.createdAt.toISOString(),
    };
  }

  private async toResponse(certification: EmployeeCertification): Promise<CertificationResponse> {
    const evidenceDoc = await this.documentsService.findCurrentScoped(
      DocumentOwnerType.CertificationEvidence,
      certification.id,
    );
    return {
      id: certification.id,
      name: certification.name,
      issuingOrganization: certification.issuingOrganization,
      credentialId: certification.credentialId ?? null,
      issueDate: certification.issueDate,
      expiryDate: certification.expiryDate ?? null,
      evidenceFileUrl: evidenceDoc?.s3Key ?? null,
      evidenceFileDisplayUrl: evidenceDoc ? await this.s3.getSignedGetUrl(evidenceDoc.s3Key) : null,
      evidenceLink: certification.evidenceLink ?? null,
      status: certification.status,
      verifiedAt: certification.verifiedAt ? certification.verifiedAt.toISOString() : null,
      rejectionReason: certification.rejectionReason ?? null,
      createdAt: certification.createdAt.toISOString(),
    };
  }
}
