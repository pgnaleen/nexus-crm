import { DealSourceCategory, UpdateDealSourceRequest } from "@orelia/common";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateDealSourceDto implements UpdateDealSourceRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  // @IsOptional() lets null/undefined both through without hitting @IsEnum --
  // null is a real "clear the category" value (Object.assign+save writes it
  // to the column), undefined means "field omitted, leave untouched".
  @IsOptional()
  @IsEnum(DealSourceCategory)
  category?: DealSourceCategory | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
