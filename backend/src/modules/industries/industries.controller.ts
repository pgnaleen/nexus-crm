import { IndustryResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { IndustriesService } from "./industries.service";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_MANAGE,
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

@Controller("industries")
export class IndustriesController {
  constructor(private readonly industriesService: IndustriesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Get()
  async findAll(): Promise<IndustryResponse[]> {
    const industries = await this.industriesService.findAll();
    return industries.map((industry) => ({ id: industry.id, name: industry.name }));
  }
}
