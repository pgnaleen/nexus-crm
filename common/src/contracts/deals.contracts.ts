import { DealType, DocumentType } from "../enums";
import { IDeal } from "../types";

export interface CompetitorEntryRequest {
  name: string;
  details: string;
}

export interface CreateDealRequest {
  name: string;
  dealType: DealType;
  // The customer: exactly one of companyId (company customer) or contactId
  // (bare contact, no company) must be provided.
  companyId?: string;
  primaryContactId?: string;
  contactId?: string;
  sourceId?: string;
  ownerId: string;
  preSalesPersonId?: string;
  pmoId?: string;
  mainStageId?: string;
  currentStageId: string;
  departmentId?: string;
  dealCountry?: string;
  customerPainPoint?: string;
  product?: string;
  services?: string;
  estimatedValue?: number;
  internalCosts?: number;
  externalCosts?: number;
  expectedCloseDate?: string;
  competitors?: CompetitorEntryRequest[];
}

export type UpdateDealRequest = Partial<Omit<CreateDealRequest, "companyId">>;

export interface MoveDealStageRequest {
  toStageId: string;
  note?: string;
}

export interface DealDependentsCountResponse {
  count: number;
}

export interface DealResponse extends IDeal {
  companyName?: string;
  companyCountry?: string | null;
  mainStageName?: string;
  currentStageName?: string;
  ownerName?: string;
  preSalesPersonName?: string | null;
  pmoName?: string | null;
  sourceName?: string | null;
  departmentName?: string | null;
  primaryContactName?: string | null;
  contactName?: string | null;
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

export interface CreateDealNoteRequest {
  text: string;
}

export type UpdateDealNoteRequest = CreateDealNoteRequest;

export interface DealNoteResponse {
  id: string;
  dealId: string;
  text: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}
