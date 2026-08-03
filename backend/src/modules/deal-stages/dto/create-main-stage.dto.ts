import { CreateMainStageRequest } from "@orelia/common";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateMainStageDto implements CreateMainStageRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(0)
  position!: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number | null;
}
