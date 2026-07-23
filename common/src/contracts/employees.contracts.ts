import { EmploymentStatus } from "../enums";

// Directory-listing shape only -- deliberately excludes every Confidential
// field (nicPassportNumber, baseSalary, etc.) IEmployee carries. Those stay
// gated behind a separate permission once that story is built; this contract
// must never grow to include them just because IEmployee already has the
// columns.
export interface EmployeeListItemResponse {
  id: string;
  fullName: string;
  title: string | null;
  departmentId: string | null;
  departmentName: string | null;
  employmentStatus: EmploymentStatus | null;
}
