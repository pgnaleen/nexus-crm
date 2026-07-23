import { ClearanceLevel, EmployeeTitle, EmploymentStatus, EmploymentType, Gender } from "../enums";

export interface IEmployee {
  id: string;
  tenantId: string;
  employeeCode?: string | null;
  title?: EmployeeTitle | null;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  nationality?: string | null;
  currentDesignation?: string | null;
  departmentId?: string | null;
  reportingManagerId?: string | null;
  employmentType?: EmploymentType | null;
  employmentStatus?: EmploymentStatus | null;
  dateOfJoined?: string | null;
  dateOfExit?: string | null;
  primaryLocation?: string | null;
  baseCountry?: string | null;
  clearanceLevel?: ClearanceLevel | null;
  bio?: string | null;
  profilePhotoUrl?: string | null;
  cvLastUpdated?: string | null;
  nicPassportNumber?: string | null;
  nicPassportEncrypted?: boolean;
  s3Key?: string | null;
  baseSalary?: number | null;
  userId?: string | null;
  employeeEmail?: string | null;
  mobileNo?: string | null;
  officeNo?: string | null;
}
