import {
  DealPriority,
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

export interface IDeal {
  id: string;
  tenantId: string;
  dealCode: string;
  name: string;
  dealType: DealType;
  description?: string | null;
  companyId?: string | null;
  primaryContactId?: string | null;
  contactId?: string | null;
  sourceId?: string | null;
  referredByCompanyId?: string | null;
  referredByEmployeeId?: string | null;
  ownerId: string;
  mainStageId?: string | null;
  currentStageId: string;
  status: DealStatus;
  estimatedValue?: number | null;
  currency?: string | null;
  expectedCloseDate?: string | null;
  probability?: number | null;
  priority?: DealPriority | null;
  departmentId?: string | null;
  // tenderDetailsId deferred until deal_tender_details exists (Tender management,
  // last table on the backlog) — same dependency pattern as Teams_Employee_Map.
}

export interface ISubStageHistory {
  id: string;
  dealId: string;
  fromStageId?: string | null;
  toStageId: string;
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
  submissionDeadline?: string | null;
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
