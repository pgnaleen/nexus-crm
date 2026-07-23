import { UpdateDealStageRequest } from "@orelia/common";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class UpdateSubStageDto implements UpdateDealStageRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;

  @IsOptional()
  @IsUUID()
  mainStageId?: string;
}
