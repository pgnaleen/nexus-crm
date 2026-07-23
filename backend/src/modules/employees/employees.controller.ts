import { EmployeeListItemResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Get, Logger, Post, UseGuards } from "@nestjs/common";
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
      const permissions = await this.rbacService.getPermissionsForUser(user.sub);
      const hasSensitiveAccess = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
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
}
