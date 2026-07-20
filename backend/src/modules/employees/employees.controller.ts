import { EmployeePickerResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { EmployeesService } from "./employees.service";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_MANAGE,
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Get("picker")
  async findPicker(): Promise<EmployeePickerResponse[]> {
    const employees = await this.employeesService.findPicker();
    return employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }));
  }
}
