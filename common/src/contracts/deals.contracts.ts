import { DealPriority, DealType } from "../enums";
import { IDeal } from "../types";

export interface CreateDealRequest {
  name: string;
  dealType: DealType;
  description?: string;
  companyId: string;
  primaryContactId?: string;
  contactId?: string;
  sourceId?: string;
  referredByCompanyId?: string;
  referredByEmployeeId?: string;
  ownerId: string;
  mainStageId?: string;
  currentStageId: string;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: string;
  probability?: number;
  priority?: DealPriority;
  departmentId?: string;
}

export type UpdateDealRequest = Partial<Omit<CreateDealRequest, "companyId">>;

export interface MoveDealStageRequest {
  toStageId: string;
  note?: string;
}

export interface DealResponse extends IDeal {
  companyName?: string;
  currentStageName?: string;
  ownerName?: string;
}
