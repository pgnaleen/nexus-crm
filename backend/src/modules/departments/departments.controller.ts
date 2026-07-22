import { DepartmentResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
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
  private readonly logger = new Logger(DepartmentsController.name);

  constructor(private readonly departmentsService: DepartmentsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.DEPARTMENT_CREATE,
    PERMISSIONS.DEPARTMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_DELETE,
  ])
  @Get()
  async findAll(): Promise<DepartmentResponse[]> {
    this.logger.debug("GET /departments called");
    try {
      const departments = await this.departmentsService.findAll();
      this.logger.debug(`GET /departments returning ${departments.length} row(s)`);
      return departments.map((department) => this.toResponse(department));
    } catch (err) {
      this.logger.error(`GET /departments failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // The dropdown/filter listing (formerly GET /departments/picker) now lives
  // in PickersController -- see backend/src/modules/pickers/pickers.controller.ts.

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEPARTMENT_CREATE])
  @Post()
  async create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DepartmentResponse> {
    this.logger.debug(`POST /departments called by ${user.sub} (name="${dto.name}")`);
    try {
      const department = await this.departmentsService.create(dto, user.sub);
      this.logger.debug(`POST /departments succeeded for department ${department.id}`);
      return this.toResponse(department);
    } catch (err) {
      this.logger.error(`POST /departments failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEPARTMENT_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DepartmentResponse> {
    this.logger.debug(`PATCH /departments/${id} called by ${user.sub}`);
    try {
      const department = await this.departmentsService.update(id, dto, user.sub);
      this.logger.debug(`PATCH /departments/${id} succeeded`);
      return this.toResponse(department);
    } catch (err) {
      this.logger.error(`PATCH /departments/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEPARTMENT_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /departments/${id} called by ${user.sub}`);
    try {
      await this.departmentsService.remove(id, user.sub);
      this.logger.debug(`DELETE /departments/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /departments/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
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
