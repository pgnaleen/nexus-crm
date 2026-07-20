import { DealResponse, PERMISSIONS } from "@orelia/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateDealDto } from "./dto/create-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Deal } from "./entities/deal.entity";
import { DealsService } from "./deals.service";

@Controller("deals")
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_READ])
  @Get()
  async findAll(@Query("mainStageId") mainStageId?: string): Promise<DealResponse[]> {
    const deals = await this.dealsService.findAll(mainStageId);
    return deals.map((deal) => this.toResponse(deal));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_READ])
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<DealResponse> {
    const deal = await this.dealsService.findOneOrFail(id);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_CREATE])
  @Post()
  async create(
    @Body() dto: CreateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.dealsService.create(dto, user.sub);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.dealsService.update(id, dto, user.sub);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post(":id/move")
  async move(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MoveDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.dealsService.moveStage(id, dto, user.sub);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_DELETE])
  @Delete(":id")
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.dealsService.remove(id);
    return { success: true };
  }

  private toResponse(deal: Deal): DealResponse {
    return {
      id: deal.id,
      tenantId: deal.tenantId,
      dealCode: deal.dealCode,
      name: deal.name,
      dealType: deal.dealType,
      description: deal.description ?? null,
      companyId: deal.companyId,
      companyName: deal.company?.name,
      primaryContactId: deal.primaryContactId ?? null,
      contactId: deal.contactId ?? null,
      sourceId: deal.sourceId ?? null,
      referredByCompanyId: deal.referredByCompanyId ?? null,
      referredByEmployeeId: deal.referredByEmployeeId ?? null,
      ownerId: deal.ownerId,
      ownerName: deal.owner?.fullName,
      mainStageId: deal.mainStageId ?? null,
      mainStageName: deal.mainStage?.name,
      currentStageId: deal.currentStageId,
      currentStageName: deal.currentStage?.name,
      status: deal.status,
      estimatedValue: deal.estimatedValue ?? null,
      currency: deal.currency ?? null,
      expectedCloseDate: deal.expectedCloseDate ?? null,
      probability: deal.probability ?? null,
      priority: deal.priority ?? null,
      departmentId: deal.departmentId ?? null,
    };
  }
}
