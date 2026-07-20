import { AddDealPartnerCompanyRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class AddDealPartnerCompanyDto implements AddDealPartnerCompanyRequest {
  @IsUUID()
  companyId!: string;
}
