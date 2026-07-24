import { CertificationResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CertificationsService } from "./certifications.service";
import { CreateCertificationDto } from "./dto/create-certification.dto";
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

  constructor(private readonly certificationsService: CertificationsService) {}

  @Get("me")
  async listMine(@CurrentUser() user: AuthenticatedUser): Promise<CertificationResponse[]> {
    this.logger.debug(`GET /certifications/me called by ${user.sub}`);
    try {
      const certifications = await this.certificationsService.listMine(user.sub);
      this.logger.debug(`GET /certifications/me returning ${certifications.length} row(s)`);
      return certifications.map((certification) => this.toResponse(certification));
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

  private toResponse(certification: EmployeeCertification): CertificationResponse {
    return {
      id: certification.id,
      name: certification.name,
      issuingOrganization: certification.issuingOrganization,
      credentialId: certification.credentialId ?? null,
      issueDate: certification.issueDate,
      expiryDate: certification.expiryDate ?? null,
      evidenceFileUrl: certification.evidenceFileUrl ?? null,
      evidenceLink: certification.evidenceLink ?? null,
      status: certification.status,
      verifiedAt: certification.verifiedAt ? certification.verifiedAt.toISOString() : null,
      rejectionReason: certification.rejectionReason ?? null,
      createdAt: certification.createdAt.toISOString(),
    };
  }
}
