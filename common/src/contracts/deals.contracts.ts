import { DealType, DocumentType, EvaluationType, SubmissionMode } from "../enums";
import { IDeal, IDealTenderDetails } from "../types";

export interface CompetitorEntryRequest {
  name: string;
  details: string;
}

export interface CreateDealRequest {
  name: string;
  dealType: DealType;
  // ISO 4217 code (e.g. "USD", "LKR") -- a deliberate choice made in the
  // form, same treatment as dealType, not optional.
  currency: string;
  // The customer: a company (companyId) or a bare contact with no company of
  // its own (contactId) -- both optional (a deal can have no customer at
  // all), and never both at once -- the service clears the other one on
  // write if a caller ever sends both.
  companyId?: string;
  primaryContactId?: string;
  contactId?: string;
  sourceId?: string;
  ownerId: string;
  preSalesPersonId?: string;
  pmoId?: string;
  // Every deal always belongs to a Main Stage. currentStageId (a Sub Stage)
  // is optional -- a deal can sit directly "in" a Main Stage that has no Sub
  // Stages configured yet, or that the tenant has chosen never to break down
  // further.
  mainStageId: string;
  currentStageId?: string;
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
  isTender?: boolean;
}

export type UpdateDealRequest = Partial<CreateDealRequest>;

// Exactly one of toStageId (a real Sub Stage) or toMainStageId (a Main Stage
// with no Sub Stage breakdown) must be provided -- enforced by MoveDealDto,
// not expressible as a TS union here without complicating every DTO/service
// call site, same tradeoff as CreateDealRequest's companyId/contactId pair.
export interface MoveDealStageRequest {
  toStageId?: string;
  toMainStageId?: string;
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

// Bulk, id-only view of every deal-partner link across the tenant -- powers
// the Funnel board's Partner filter (client-side, alongside the already
// per-deal companyId/contactId used for the Customer filter) without
// embedding full partner objects into the DealResponse list payload, which
// is fetched on every Funnel page load.
export interface DealPartnerLinkResponse {
  dealId: string;
  companyId: string | null;
  contactId: string | null;
}

export interface DealStageHistoryResponse {
  id: string;
  kind: "main_stage" | "sub_stage";
  fromStageId: string | null;
  fromStageName: string | null;
  // Null on a "sub_stage" entry when the move left the deal with no Sub
  // Stage (moved to a Main-Stage-only position). Always present on a
  // "main_stage" entry -- a Main Stage move always has a real target.
  toStageId: string | null;
  toStageName: string | null;
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
  // null once the note has been deleted -- the row still comes back (as a
  // "this note was deleted" tombstone, chat convention) but its content
  // doesn't.
  text: string | null;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// One row per deal -- upsert (create-if-missing, else update), not
// separate create/update endpoints, matching the 1:1 relationship.
export interface UpsertDealTenderDetailsRequest {
  tenderReference: string;
  issuingBody: string;
  bidBondRequired?: boolean;
  bidBondAmount?: number;
  emdAmount?: number;
  submissionMode?: SubmissionMode;
  evaluationType?: EvaluationType;
}

export type DealTenderDetailsResponse = IDealTenderDetails;
