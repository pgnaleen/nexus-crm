import { PERMISSIONS, RelationshipTypeResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateRelationshipTypeDto } from "./dto/create-relationship-type.dto";
import { UpdateRelationshipTypeDto } from "./dto/update-relationship-type.dto";
import { RelationshipType } from "./entities/relationship-type.entity";
import { RelationshipTypesService } from "./relationship-types.service";

@Controller("relationship-types")
export class RelationshipTypesController {
  constructor(private readonly relationshipTypesService: RelationshipTypesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([
    PERMISSIONS.RELATIONSHIP_TYPE_VIEW,
    PERMISSIONS.RELATIONSHIP_TYPE_CREATE,
    PERMISSIONS.RELATIONSHIP_TYPE_UPDATE,
    PERMISSIONS.RELATIONSHIP_TYPE_DELETE,
  ])
  @Get()
  async findAll(): Promise<RelationshipTypeResponse[]> {
    const withCounts = await this.relationshipTypesService.findAllWithDependentCounts();
    return withCounts.map(({ type, dependentCount }) => this.toResponse(type, dependentCount));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_TYPE_CREATE])
  @Post()
  async create(
    @Body() dto: CreateRelationshipTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipTypeResponse> {
    const type = await this.relationshipTypesService.create(dto, user.sub);
    return this.toResponse(type, 0);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_TYPE_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRelationshipTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipTypeResponse> {
    const type = await this.relationshipTypesService.update(id, dto, user.sub);
    const dependentCount = await this.relationshipTypesService.countDependents(id);
    return this.toResponse(type, dependentCount);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_TYPE_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.relationshipTypesService.remove(id, user.sub);
    return { success: true };
  }

  private toResponse(type: RelationshipType, dependentCount: number): RelationshipTypeResponse {
    return {
      id: type.id,
      tenantId: type.tenantId,
      name: type.name,
      dependentCount,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString(),
    };
  }
}
