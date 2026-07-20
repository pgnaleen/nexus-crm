import { CompanyPickerResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CompaniesService } from "./companies.service";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_MANAGE,
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Get("picker")
  async findPicker(
    @Query("search") search?: string,
    @Query("excludeId") excludeId?: string,
  ): Promise<CompanyPickerResponse[]> {
    const companies = await this.companiesService.findPicker(search, excludeId);
    return companies.map((company) => ({ id: company.id, name: company.name }));
  }
}
