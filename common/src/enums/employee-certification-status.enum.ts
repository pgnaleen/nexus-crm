// Story 1.12/1.13 -- lifecycle of a self-reported certification claim.
// Pending: just submitted, unverified, does NOT count toward the certified-
// employee staffing search (Story 1.14). Verified: HR checked the evidence
// (Story 1.13); counts toward search; locked from employee edits. Rejected:
// HR checked and it didn't hold up; carries a rejectionReason.
export enum EmployeeCertificationStatus {
  Pending = "pending",
  Verified = "verified",
  Rejected = "rejected",
}
