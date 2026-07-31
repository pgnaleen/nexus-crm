import { AddRelationshipTagRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class AddRelationshipTagDto implements AddRelationshipTagRequest {
  @IsUUID()
  relationshipTypeId!: string;
}
