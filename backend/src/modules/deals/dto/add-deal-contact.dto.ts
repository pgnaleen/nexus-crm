import { AddDealContactRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class AddDealContactDto implements AddDealContactRequest {
  @IsUUID()
  contactId!: string;
}
