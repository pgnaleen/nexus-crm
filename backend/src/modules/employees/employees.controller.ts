import { DocumentOwnerType, EmployeeDetailResponse, EmployeeListItemResponse, OrgChartEmployeeResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { S3Service } from "../../core/storage/s3.service";
import { DocumentsService } from "../documents/documents.service";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RbacService } from "../rbac/rbac.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateMyPhotoDto } from "./dto/update-my-photo.dto";
import { UpdateOrgChartStructureDto } from "./dto/update-org-chart-structure.dto";
import { Employee } from "./entities/employee.entity";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  private readonly logger = new Logger(EmployeesController.name);

  constructor(
    private readonly employeesService: EmployeesService,
    private readonly rbacService: RbacService,
    private readonly documentsService: DocumentsService,
    private readonly s3: S3Service,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VIEW])
  @Get()
  async findAll(): Promise<EmployeeListItemResponse[]> {
    this.logger.debug("GET /employees called");
    try {
      const employees = await this.employeesService.findAll();
      this.logger.debug(`GET /employees returning ${employees.length} row(s)`);
      return employees.map((employee) => this.toListItemResponse(employee));
    } catch (err) {
      this.logger.error(`GET /employees failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_CREATE])
  @Post()
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeListItemResponse> {
    this.logger.debug(`POST /employees called by ${user.sub} (fullName="${dto.fullName}")`);
    try {
      // Never trust the frontend alone to hide the Confidential tab -- a
      // caller without EMPLOYEES_VIEW_SENSITIVE has these fields silently
      // stripped here regardless of what the request body contains.
      const hasSensitiveAccess = await this.hasSensitiveAccess(user.sub);
      if (!hasSensitiveAccess) {
        this.logger.debug("POST /employees: caller lacks EMPLOYEES_VIEW_SENSITIVE, stripping confidential fields");
        dto.nicPassportNumber = undefined;
        dto.baseSalary = undefined;
      }

      const employee = await this.employeesService.create(dto, user.sub);
      this.logger.debug(`POST /employees succeeded for employee ${employee.id}`);
      return this.toListItemResponse(employee);
    } catch (err) {
      this.logger.error(`POST /employees failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.11 -- the caller's OWN employee record for the My Profile page.
  // No PermissionsGuard/RequirePermission: any authenticated user may see
  // what HR has on file for THEM (global JwtAuthGuard still applies), same
  // posture as POST /users/me/change-password. Confidential fields are
  // always nulled here -- "it's my own data" does not bypass
  // EMPLOYEES_VIEW_SENSITIVE (AC). Returns null when the caller's account
  // isn't linked to any employee record. Declared before the ":id" routes.
  @Get("me")
  async findMyEmployeeRecord(@CurrentUser() user: AuthenticatedUser): Promise<EmployeeDetailResponse | null> {
    this.logger.debug(`GET /employees/me called by ${user.sub}`);
    try {
      const bare = await this.employeesService.findByUserId(user.sub);
      if (!bare) {
        this.logger.debug(`GET /employees/me: no employee linked to user ${user.sub}`);
        return null;
      }
      const employee = await this.employeesService.findOneOrFail(bare.id);
      this.logger.debug(`GET /employees/me succeeded (employee ${employee.id})`);
      return this.toDetailResponse(employee, false);
    } catch (err) {
      this.logger.error(`GET /employees/me failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Self-service profile photo. Auth-only (no RequirePermission, global
  // JwtAuthGuard still applies): the target row is resolved from the caller's
  // own token rather than a path param, so there is no id to tamper with --
  // same posture as POST /users/me/change-password and the certifications
  // routes. The photo is the single exception to My Profile's otherwise
  // read-only, HR-controlled employee record. Declared before the ":id"
  // routes, or "me" would be captured as :id and rejected by ParseUUIDPipe.
  @Patch("me/photo")
  async updateMyPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMyPhotoDto,
  ): Promise<EmployeeDetailResponse> {
    this.logger.debug(
      `PATCH /employees/me/photo called by ${user.sub} (action=${dto.profilePhotoUrl ? "set" : "clear"})`,
    );
    try {
      const employee = await this.employeesService.updateMyPhoto(user.sub, dto.profilePhotoUrl);
      this.logger.debug(`PATCH /employees/me/photo succeeded (employee ${employee.id})`);
      // hasSensitiveAccess=false: this is the caller's own record, but "it's
      // mine" never bypasses EMPLOYEES_VIEW_SENSITIVE -- identical to GET
      // /employees/me above.
      return this.toDetailResponse(employee, false);
    } catch (err) {
      this.logger.error(`PATCH /employees/me/photo failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.7 -- Organization Chart data: every non-exited employee with
  // the reporting edge (reportingManagerId). Declared BEFORE @Get(":id") --
  // otherwise "org-chart" would be captured as :id and rejected by
  // ParseUUIDPipe.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VIEW])
  @Get("org-chart")
  async findOrgChart(): Promise<OrgChartEmployeeResponse[]> {
    this.logger.debug("GET /employees/org-chart called");
    try {
      const employees = await this.employeesService.findForOrgChart();
      const responses = await Promise.all(
        employees.map(async (employee) => {
          const photoDoc = await this.documentsService.findCurrentScoped(DocumentOwnerType.EmployeePhoto, employee.id);
          return {
            id: employee.id,
            fullName: employee.fullName,
            currentDesignation: employee.currentDesignation ?? null,
            departmentId: employee.departmentId ?? null,
            departmentName: employee.department?.name ?? null,
            profilePhotoUrl: photoDoc?.s3Key ?? null,
            profilePhotoDisplayUrl: photoDoc ? await this.s3.getSignedGetUrl(photoDoc.s3Key) : null,
            reportingManagerId: employee.reportingManagerId ?? null,
            placedAtRoot: employee.placedAtRoot,
          };
        }),
      );
      this.logger.debug(`GET /employees/org-chart returning ${responses.length} row(s)`);
      return responses;
    } catch (err) {
      this.logger.error(`GET /employees/org-chart failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.8 -- the chart editor's batch commit. Nothing is written while
  // the user drags things around; this single call receives every changed
  // reporting relationship together after the Save confirmation.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_UPDATE])
  @Patch("org-chart/structure")
  async updateOrgChartStructure(
    @Body() dto: UpdateOrgChartStructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`PATCH /employees/org-chart/structure called by ${user.sub} (${dto.changes.length} change(s))`);
    try {
      await this.employeesService.updateOrgChartStructure(dto, user.sub);
      this.logger.debug("PATCH /employees/org-chart/structure succeeded");
      return { success: true };
    } catch (err) {
      this.logger.error(
        `PATCH /employees/org-chart/structure failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  // Story 1.3 -- full read-only record. nicPassportNumber/baseSalary are
  // nulled here for a caller without EMPLOYEES_VIEW_SENSITIVE regardless of
  // what's actually stored, same posture as the create endpoint's stripping.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_VIEW])
  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeDetailResponse> {
    this.logger.debug(`GET /employees/${id} called by ${user.sub}`);
    try {
      const [employee, hasSensitiveAccess] = await Promise.all([
        this.employeesService.findOneOrFail(id),
        this.hasSensitiveAccess(user.sub),
      ]);
      this.logger.debug(`GET /employees/${id} succeeded (sensitiveAccess=${hasSensitiveAccess})`);
      return this.toDetailResponse(employee, hasSensitiveAccess);
    } catch (err) {
      this.logger.error(`GET /employees/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.4 -- partial update, same tabbed field set as create. Sensitive
  // stripping here uses `delete` (not `= undefined`): the service only
  // assigns/diffs keys present on the dto, so deleting the keys guarantees a
  // caller without EMPLOYEES_VIEW_SENSITIVE can neither read, set, nor
  // accidentally wipe nicPassportNumber/baseSalary.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeDetailResponse> {
    this.logger.debug(`PATCH /employees/${id} called by ${user.sub}`);
    try {
      const hasSensitiveAccess = await this.hasSensitiveAccess(user.sub);
      if (!hasSensitiveAccess) {
        this.logger.debug(`PATCH /employees/${id}: caller lacks EMPLOYEES_VIEW_SENSITIVE, deleting confidential keys`);
        delete dto.nicPassportNumber;
        delete dto.baseSalary;
      }

      const employee = await this.employeesService.update(id, dto, user.sub);
      this.logger.debug(`PATCH /employees/${id} succeeded`);
      return this.toDetailResponse(employee, hasSensitiveAccess);
    } catch (err) {
      this.logger.error(`PATCH /employees/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.5 -- soft delete, deliberately separate from "Mark as Exited"
  // (which is a PATCH of employmentStatus + dateOfExit and keeps the record
  // visible). Same {success} response shape as Departments/Teams/Users.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.EMPLOYEES_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /employees/${id} called by ${user.sub}`);
    try {
      await this.employeesService.remove(id, user.sub);
      this.logger.debug(`DELETE /employees/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /employees/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async hasSensitiveAccess(userId: string): Promise<boolean> {
    const permissions = await this.rbacService.getPermissionsForUser(userId);
    return permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
  }

  private toListItemResponse(employee: Employee): EmployeeListItemResponse {
    return {
      id: employee.id,
      fullName: employee.fullName,
      title: employee.title ?? null,
      departmentId: employee.departmentId ?? null,
      departmentName: employee.department?.name ?? null,
      employmentStatus: employee.employmentStatus ?? null,
    };
  }

  private async toDetailResponse(employee: Employee, hasSensitiveAccess: boolean): Promise<EmployeeDetailResponse> {
    // Photo/CV now live in the shared documents table -- the row itself
    // only ever stores the bare S3 key (doc.s3Key). *DisplayUrl fields are
    // fresh signed URLs generated here, on every response, never persisted.
    const [photoDoc, cvDoc] = await Promise.all([
      this.documentsService.findCurrentScoped(DocumentOwnerType.EmployeePhoto, employee.id),
      this.documentsService.findCurrentScoped(DocumentOwnerType.EmployeeCv, employee.id),
    ]);
    const [profilePhotoDisplayUrl, cvDisplayUrl] = await Promise.all([
      photoDoc ? this.s3.getSignedGetUrl(photoDoc.s3Key) : null,
      cvDoc ? this.s3.getSignedGetUrl(cvDoc.s3Key) : null,
    ]);
    return {
      id: employee.id,
      fullName: employee.fullName,
      dateOfBirth: employee.dateOfBirth ?? null,
      gender: employee.gender ?? null,
      nationality: employee.nationality ?? null,
      bio: employee.bio ?? null,
      profilePhotoUrl: photoDoc?.s3Key ?? null,
      profilePhotoDisplayUrl,
      employeeCode: employee.employeeCode ?? null,
      title: employee.title ?? null,
      currentDesignation: employee.currentDesignation ?? null,
      departmentId: employee.departmentId ?? null,
      departmentName: employee.department?.name ?? null,
      employmentType: employee.employmentType ?? null,
      employmentStatus: employee.employmentStatus ?? null,
      dateOfJoined: employee.dateOfJoined ?? null,
      dateOfExit: employee.dateOfExit ?? null,
      primaryLocation: employee.primaryLocation ?? null,
      baseCountry: employee.baseCountry ?? null,
      clearanceLevel: employee.clearanceLevel ?? null,
      cvUrl: cvDoc?.s3Key ?? null,
      cvDisplayUrl,
      employeeEmail: employee.employeeEmail ?? null,
      mobileNo: employee.mobileNo ?? null,
      officeNo: employee.officeNo ?? null,
      linkedUser: employee.user
        ? { id: employee.user.id, username: employee.user.username, displayName: employee.user.displayName }
        : null,
      nicPassportNumber: hasSensitiveAccess ? (employee.nicPassportNumber ?? null) : null,
      baseSalary: hasSensitiveAccess ? (employee.baseSalary ?? null) : null,
    };
  }
}
