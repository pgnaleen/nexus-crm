import { EmployeeDetailResponse, EmployeeListItemResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RbacService } from "../rbac/rbac.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { Employee } from "./entities/employee.entity";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  private readonly logger = new Logger(EmployeesController.name);

  constructor(
    private readonly employeesService: EmployeesService,
    private readonly rbacService: RbacService,
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

  private toDetailResponse(employee: Employee, hasSensitiveAccess: boolean): EmployeeDetailResponse {
    return {
      id: employee.id,
      fullName: employee.fullName,
      dateOfBirth: employee.dateOfBirth ?? null,
      gender: employee.gender ?? null,
      nationality: employee.nationality ?? null,
      bio: employee.bio ?? null,
      profilePhotoUrl: employee.profilePhotoUrl ?? null,
      employeeCode: employee.employeeCode ?? null,
      title: employee.title ?? null,
      currentDesignation: employee.currentDesignation ?? null,
      departmentId: employee.departmentId ?? null,
      departmentName: employee.department?.name ?? null,
      employmentType: employee.employmentType ?? null,
      employmentStatus: employee.employmentStatus ?? null,
      dateOfJoined: employee.dateOfJoined ?? null,
      primaryLocation: employee.primaryLocation ?? null,
      baseCountry: employee.baseCountry ?? null,
      clearanceLevel: employee.clearanceLevel ?? null,
      cvUrl: employee.s3Key ?? null,
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
