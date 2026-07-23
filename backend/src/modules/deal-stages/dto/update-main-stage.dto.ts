import { UpdateMainStageRequest } from "@orelia/common";
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UpdateMainStageDto implements UpdateMainStageRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
