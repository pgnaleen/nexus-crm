import { OrgChartStructureChange, UpdateOrgChartStructureRequest } from "@orelia/common";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUUID, ValidateNested } from "class-validator";

// Story 1.8 -- one entry per employee whose placement changed in the chart
// editor. reportingManagerId null + placedAtRoot false = back to unplaced;
// placedAtRoot true requires reportingManagerId null (enforced in the
// service, where the cross-field rules and cycle detection live).
export class OrgChartStructureChangeDto implements OrgChartStructureChange {
  @IsUUID()
  employeeId!: string;

  // Nullable on purpose -- @IsOptional() lets null through; the service
  // treats null and undefined identically here (no manager).
  @IsOptional()
  @IsUUID()
  reportingManagerId!: string | null;

  @IsBoolean()
  placedAtRoot!: boolean;
}

export class UpdateOrgChartStructureDto implements UpdateOrgChartStructureRequest {
  @IsArray()
  @ArrayMinSize(1)
  // Generous ceiling -- a batch can only ever contain one entry per employee
  // in the tenant; this is a runaway-payload guard, not a business rule.
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => OrgChartStructureChangeDto)
  changes!: OrgChartStructureChangeDto[];
}
