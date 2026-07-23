import { SystemRole, UpdateRelationshipTypeRequest } from "@orelia/common";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateRelationshipTypeDto implements UpdateRelationshipTypeRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  // @IsOptional() lets null/undefined both through without hitting @IsEnum --
  // null is a real "unflag this type" value, undefined means "field omitted,
  // leave untouched".
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole | null;
}
