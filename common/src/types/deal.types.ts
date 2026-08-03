import {
  DealSourceCategory,
  DealStatus,
  DealType,
  DocumentType,
  EvaluationType,
  ReviewDecision,
  ReviewType,
  ReviewVote,
  SubmissionMode,
} from "../enums";

export interface IDealSource {
  id: string;
  tenantId: string;
  name: string;
  category?: DealSourceCategory | null;
  isActive: boolean;
}

export interface IMainStage {
  id: string;
  tenantId: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
  // Admin-configurable progress weight (0-100), shown on the Funnel board's
  // column header and deal cards -- null when the admin hasn't set one yet.
  weightPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IDealStage {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  mainStageId: string;
}

export interface ICompetitorEntry {
  name: string;
  details: string;
}

export interface IDeal {
  id: string;
  tenantId: string;
  dealCode: string;
  name: string;
  dealType: DealType;
  companyId?: string | null;
  primaryContactId?: string | null;
  contactId?: string | null;
  sourceId?: string | null;
  mainStageId: string;
  currentStageId?: string | null;
  status: DealStatus;
  // ISO 4217 code -- never null, every deal has some currency.
  currency: string;
  departmentId?: string | null;
  dealCountry?: string | null;
  customerPainPoint?: string | null;
  product?: string | null;
  services?: string | null;
  estimatedValue?: number | null;
  internalCosts?: number | null;
  externalCosts?: number | null;
  expectedCloseDate?: string | null;
  competitors?: ICompetitorEntry[] | null;
  isTender: boolean;
}

export interface ISubStageHistory {
  id: string;
  dealId: string;
  fromStageId?: string | null;
  toStageId?: string | null;
  movedById?: string | null;
  movedAt: string;
  note?: string | null;
}

export interface IDealDocument {
  id: string;
  dealId: string;
  docType: DocumentType;
  title: string;
  s3Key: string;
}

export interface IDealReview {
  id: string;
  dealId: string;
  reviewType: ReviewType;
  decision: ReviewDecision;
  overallComment?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface IDealReviewVote {
  id: string;
  reviewId: string;
  reviewerId: string;
  vote: ReviewVote;
  comment?: string | null;
  votedAt: string;
}

export interface IDealTenderDetails {
  id: string;
  dealId: string;
  tenderReference: string;
  issuingBody: string;
  bidBondRequired: boolean;
  bidBondAmount?: number | null;
  emdAmount?: number | null;
  submissionMode?: SubmissionMode | null;
  evaluationType?: EvaluationType | null;
}

export interface IMainStageHistory {
  id: string;
  dealId: string;
  fromStageId?: string | null;
  toStageId: string;
  movedById?: string | null;
  movedAt: string;
  note?: string | null;
}

export interface IDealRole {
  id: string;
  tenantId: string;
  name: string;
  // True only for the seeded "Sales Person" role -- a deal must have exactly
  // one primary assignee for this role, enforced at creation time.
  requiresPrimaryOnCreate: boolean;
}

export interface IDealRoleAssignment {
  id: string;
  dealId: string;
  roleId: string;
  userId: string;
  isPrimary: boolean;
  createdAt: string;
  createdById?: string | null;
}
