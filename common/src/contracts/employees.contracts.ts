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
