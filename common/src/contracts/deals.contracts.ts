import { DealPriority, DealType, DocumentType } from "../enums";
import { IDeal } from "../types";

export interface CreateDealRequest {
  name: string;
  dealType: DealType;
  description?: string;
  // The customer: exactly one of companyId (company customer) or contactId
  // (bare contact, no company) must be provided.
  companyId?: string;
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
  mainStageName?: string;
  currentStageName?: string;
  ownerName?: string;
}

export interface CreateDealDocumentRequest {
  docType: DocumentType;
  title: string;
}

export interface DealDocumentResponse {
  id: string;
  dealId: string;
  docType: DocumentType;
  title: string;
  url: string;
  createdAt: string;
}

export interface AddDealPartnerCompanyRequest {
  companyId: string;
}

export interface AddDealPartnerContactRequest {
  contactId: string;
}

export interface DealPartnerResponse {
  id: string;
  kind: "company" | "contact";
  companyId?: string | null;
  contactId?: string | null;
  name: string;
  subtitle?: string | null;
}

export interface DealStageHistoryResponse {
  id: string;
  kind: "main_stage" | "sub_stage";
  fromStageId: string | null;
  fromStageName: string | null;
  toStageId: string;
  toStageName: string;
  movedById: string | null;
  movedByName: string | null;
  movedAt: string;
  note: string | null;
}
