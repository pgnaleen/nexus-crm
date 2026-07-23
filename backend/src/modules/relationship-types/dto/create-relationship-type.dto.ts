import { CreateRelationshipTypeRequest, SystemRole } from "@orelia/common";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRelationshipTypeDto implements CreateRelationshipTypeRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  // @IsOptional() lets null/undefined both through without hitting @IsEnum --
  // null flags nothing (the default), a real enum value flags this row as the
  // tenant's Customer/Partner type.
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole | null;
}
