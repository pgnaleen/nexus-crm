import { CreateRelationshipTypeRequest } from "@orelia/common";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateRelationshipTypeDto implements CreateRelationshipTypeRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
