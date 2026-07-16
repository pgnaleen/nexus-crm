import { UpdateRelationshipTypeRequest } from "@orelia/common";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateRelationshipTypeDto implements UpdateRelationshipTypeRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}
