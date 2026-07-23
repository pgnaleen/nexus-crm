import { ClearanceLevel, EmployeeTitle, EmploymentStatus, EmploymentType, Gender } from "../enums";

// Directory-listing shape only -- deliberately excludes every Confidential
// field (nicPassportNumber, baseSalary, etc.) IEmployee carries. Those stay
// gated behind a separate permission once that story is built; this contract
// must never grow to include them just because IEmployee already has the
// columns.
export interface EmployeeListItemResponse {
  id: string;
  fullName: string;
  title: EmployeeTitle | null;
  departmentId: string | null;
  departmentName: string | null;
  employmentStatus: EmploymentStatus | null;
}

// Story 1.2 (Create Employee). No reportingManagerId -- every new employee
// starts unplaced; who they report to is set exclusively via the
// Organization Chart (Story 1.8), never at creation. Confidential fields
// (nicPassportNumber, baseSalary) are optional and only meaningful when the
// caller holds EMPLOYEES_VIEW_SENSITIVE -- the backend silently drops them
// otherwise rather than erroring, since the frontend never renders those
// fields at all for a caller without that permission.
export interface CreateEmployeeRequest {
  // Personal
  fullName: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  bio?: string;
  profilePhotoUrl?: string;
  // Employment
  employeeCode?: string;
  title?: EmployeeTitle;
  currentDesignation?: string;
  departmentId?: string;
  employmentType?: EmploymentType;
  employmentStatus?: EmploymentStatus;
  dateOfJoined?: string;
  primaryLocation?: string;
  baseCountry?: string;
  clearanceLevel?: ClearanceLevel;
  cvUrl?: string;
  // Contact
  employeeEmail?: string;
  mobileNo?: string;
  officeNo?: string;
  // Confidential -- EMPLOYEES_VIEW_SENSITIVE only
  nicPassportNumber?: string;
  baseSalary?: number;
}

// Story 1.4 (Update Employee Record) -- PATCH /employees/:id. Tri-state
// semantics per field: key absent/undefined = leave the column unchanged,
// null = clear the column, value = set it. The edit form always sends every
// field it renders (with null for cleared ones), so "clear a previously-set
// optional field" genuinely clears (AC5). Confidential fields are omitted
// entirely by the frontend when the caller can't see the Confidential tab,
// and independently `delete`d server-side for a caller without
// EMPLOYEES_VIEW_SENSITIVE -- absent keys are never assigned or diffed, so
// an edit can't wipe sensitive data the editor can't see (AC4).
// reportingManagerId is deliberately NOT here -- who someone reports to is
// only ever edited via the Organization Chart (Story 1.8). The userId link
// is only ever edited from User Management (Story 1.6).
export interface UpdateEmployeeRequest {
  // Personal
  fullName?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  nationality?: string | null;
  bio?: string | null;
  profilePhotoUrl?: string | null;
  // Employment
  employeeCode?: string | null;
  title?: EmployeeTitle | null;
  currentDesignation?: string | null;
  departmentId?: string | null;
  employmentType?: EmploymentType | null;
  employmentStatus?: EmploymentStatus | null;
  dateOfJoined?: string | null;
  // Story 1.5 -- set by the "Mark as Exited" flow (together with an exited
  // employmentStatus), not rendered on the general edit form.
  dateOfExit?: string | null;
  primaryLocation?: string | null;
  baseCountry?: string | null;
  clearanceLevel?: ClearanceLevel | null;
  cvUrl?: string | null;
  // Contact
  employeeEmail?: string | null;
  mobileNo?: string | null;
  officeNo?: string | null;
  // Confidential -- EMPLOYEES_VIEW_SENSITIVE only
  nicPassportNumber?: string | null;
  baseSalary?: number | null;
}

// Story 1.3 (View Employee Details) -- full read-only record, same tab
// grouping as CreateEmployeeRequest (Personal/Employment/Contact/
// Confidential) plus which login account this employee is linked to
// (read-only here -- the link itself is only ever created/changed from User
// Management, Story 1.6). nicPassportNumber/baseSalary are nulled server-side
// for any caller without EMPLOYEES_VIEW_SENSITIVE, regardless of whether the
// employee actually has values set -- same posture as the create endpoint.
export interface EmployeeDetailResponse {
  id: string;
  // Personal
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  nationality: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  // Employment
  employeeCode: string | null;
  title: EmployeeTitle | null;
  currentDesignation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  employmentType: EmploymentType | null;
  employmentStatus: EmploymentStatus | null;
  dateOfJoined: string | null;
  // Story 1.5 -- present once an employee has been marked as exited.
  dateOfExit: string | null;
  primaryLocation: string | null;
  baseCountry: string | null;
  clearanceLevel: ClearanceLevel | null;
  cvUrl: string | null;
  // Contact
  employeeEmail: string | null;
  mobileNo: string | null;
  officeNo: string | null;
  // Linked login account -- read-only, set via User Management (Story 1.6)
  linkedUser: { id: string; username: string; displayName: string } | null;
  // Confidential -- null unless the caller holds EMPLOYEES_VIEW_SENSITIVE
  nicPassportNumber: string | null;
  baseSalary: number | null;
}
