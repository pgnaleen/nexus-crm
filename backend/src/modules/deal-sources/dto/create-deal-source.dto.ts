import { CreateDealSourceRequest, DealSourceCategory } from "@orelia/common";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateDealSourceDto implements CreateDealSourceRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsEnum(DealSourceCategory)
  category?: DealSourceCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
