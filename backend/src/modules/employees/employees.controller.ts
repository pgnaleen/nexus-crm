import { EmployeeListItemResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, Logger, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { Employee } from "./entities/employee.entity";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  private readonly logger = new Logger(EmployeesController.name);

  constructor(private readonly employeesService: EmployeesService) {}

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
