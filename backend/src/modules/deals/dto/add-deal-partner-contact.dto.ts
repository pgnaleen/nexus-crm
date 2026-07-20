import { AddDealPartnerContactRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class AddDealPartnerContactDto implements AddDealPartnerContactRequest {
  @IsUUID()
  contactId!: string;
}
