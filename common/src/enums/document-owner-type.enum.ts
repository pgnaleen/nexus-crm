// What kind of record a `documents` row is attached to (see the `documents`
// table -- a single generic store for every file attachment in the app:
// deal documents, certification evidence, employee photo/CV, company logo).
export enum DocumentOwnerType {
  CompanyLogo = "company_logo",
  EmployeePhoto = "employee_photo",
  EmployeeCv = "employee_cv",
  DealDocument = "deal_document",
  CertificationEvidence = "certification_evidence",
}
