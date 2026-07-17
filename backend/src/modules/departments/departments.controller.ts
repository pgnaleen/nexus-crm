import { DepartmentResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { Department } from "./entities/department.entity";
import { DepartmentsService } from "./departments.service";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([
    PERMISSIONS.DEPARTMENT_MANAGE,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.DEPARTMENT_CREATE,
    PERMISSIONS.DEPARTMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_DELETE,
  ])
  @Get()
  async findAll(): Promise<DepartmentResponse[]> {
    const departments = await this.departmentsService.findAll();
    return departments.map((department) => this.toResponse(department));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.DEPARTMENT_CREATE])
  @Post()
  async create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DepartmentResponse> {
    const department = await this.departmentsService.create(dto, user.sub);
    return this.toResponse(department);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.DEPARTMENT_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DepartmentResponse> {
    const department = await this.departmentsService.update(id, dto, user.sub);
    return this.toResponse(department);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEPARTMENT_MANAGE, PERMISSIONS.DEPARTMENT_DELETE])
  @Delete(":id")
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.departmentsService.remove(id);
    return { success: true };
  }

  private toResponse(department: Department): DepartmentResponse {
    return {
      id: department.id,
      tenantId: department.tenantId,
      name: department.name,
      isActive: department.isActive,
      createdAt: department.createdAt.toISOString(),
      updatedAt: department.updatedAt.toISOString(),
    };
  }
}
