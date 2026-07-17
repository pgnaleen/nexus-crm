import { CreateDealStageRequest } from "@orelia/common";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateSubStageDto implements CreateDealStageRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;

  @IsUUID()
  mainStageId!: string;
}
