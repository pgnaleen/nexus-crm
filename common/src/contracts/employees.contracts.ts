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

// Story 1.7 (View the Organization Chart) -- every non-exited employee in
// the tenant, with just the fields the chart needs. reportingManagerId is
// the tree edge: set = placed beneath that manager on the canvas, null =
// listed in the "unplaced" side panel (every brand-new employee starts
// there, since the Employee form never sets a manager -- Story 1.8's chart
// editor is the only writer). Exited employees are excluded server-side.
export interface OrgChartEmployeeResponse {
  id: string;
  fullName: string;
  currentDesignation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  // profilePhotoUrl is the stored S3 key; profilePhotoDisplayUrl is a fresh
  // signed URL generated at response time, for rendering the chart node only.
  profilePhotoUrl: string | null;
  profilePhotoDisplayUrl: string | null;
  reportingManagerId: string | null;
  // Story 1.8 -- placed directly beneath the Company root (top of a
  // reporting line). Placed = reportingManagerId set OR placedAtRoot;
  // neither = unplaced panel.
  placedAtRoot: boolean;
}

// Story 1.8 (Restructure the Org Chart) -- batch save of every changed
// reporting relationship in one request. Per entry: reportingManagerId set
// = reports to that employee; placedAtRoot true (managerId must be null) =
// top-level under the Company root; both null/false = back to unplaced.
// The endpoint validates tenant membership, non-exited targets, and rejects
// any cycle server-side (the UI also blocks cycles at draw time).
export interface OrgChartStructureChange {
  employeeId: string;
  reportingManagerId: string | null;
  placedAtRoot: boolean;
}

export interface UpdateOrgChartStructureRequest {
  changes: OrgChartStructureChange[];
}

// Self-service profile photo (PATCH /employees/me/photo). The employee record
// is otherwise HR-controlled and read-only from My Profile -- the photo is the
// single field its own owner may set, so it gets its own narrow request shape
// rather than going through UpdateEmployeeRequest (which carries every other
// column and is gated on EMPLOYEES_UPDATE).
//
// profilePhotoUrl is an S3 key returned by POST /uploads/my-photo; null clears
// the current photo.
export interface UpdateMyPhotoRequest {
  profilePhotoUrl: string | null;
}

// Story 1.6 (Grant Login Access) -- options for User Management's "link to
// Employee" picker: employees in the caller's tenant not yet linked to any
// User account (plus, when editing an existing user, the employee currently
// linked to that user so the selection can be displayed/kept). employeeEmail
// rides along so Add User can pre-fill Display Name + Login Email from the
// HR record.
export interface EmployeeLinkPickerResponse {
  id: string;
  fullName: string;
  employeeEmail: string | null;
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
  // profilePhotoUrl/cvUrl are the stored S3 keys, submitted back verbatim on
  // save if untouched. The matching *DisplayUrl fields are fresh, short-lived
  // signed URLs generated at response-build time purely for rendering --
  // never persisted.
  profilePhotoUrl: string | null;
  profilePhotoDisplayUrl: string | null;
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
  cvDisplayUrl: string | null;
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
