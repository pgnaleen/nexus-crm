import { EmployeeCertificationStatus } from "../enums";

// Story 1.12 (Self-Report a Certification). The employee-facing shape shown
// on My Profile. Deliberately does NOT expose who verified it or their user
// id -- the employee only needs the status and, if rejected, why. HR-facing
// review responses (Story 1.13) and the staffing search (Story 1.14) get
// their own richer contracts.
export interface CertificationResponse {
  id: string;
  name: string;
  issuingOrganization: string;
  credentialId: string | null;
  issueDate: string;
  expiryDate: string | null;
  evidenceFileUrl: string | null;
  evidenceLink: string | null;
  status: EmployeeCertificationStatus;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

// Evidence (evidenceFileUrl / evidenceLink) is optional at submit time by
// design -- an employee can start the record before they have the file to
// hand. Story 1.13 enforces that a claim with neither cannot be marked
// Verified. Both may be provided; neither is required.
export interface CreateCertificationRequest {
  name: string;
  issuingOrganization: string;
  credentialId?: string;
  issueDate: string;
  expiryDate?: string;
  evidenceFileUrl?: string;
  evidenceLink?: string;
}

// Tri-state per optional field (absent = unchanged, null = clear, value =
// set), same convention as UpdateEmployeeRequest. Only accepted while the
// claim is still Pending -- the service rejects edits to Verified/Rejected
// records.
export interface UpdateCertificationRequest {
  name?: string;
  issuingOrganization?: string;
  credentialId?: string | null;
  issueDate?: string;
  expiryDate?: string | null;
  evidenceFileUrl?: string | null;
  evidenceLink?: string | null;
}
