import { DashboardLayoutItem, UpdateDashboardPreferenceRequest } from "@orelia/common";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class DashboardLayoutItemDto implements DashboardLayoutItem {
  @IsString()
  @MaxLength(100)
  i!: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsInt()
  @Min(1)
  w!: number;

  @IsInt()
  @Min(1)
  h!: number;
}

export class UpdateDashboardPreferenceDto implements UpdateDashboardPreferenceRequest {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  visibleWidgetKeys!: string[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DashboardLayoutItemDto)
  layout!: DashboardLayoutItemDto[];
}
