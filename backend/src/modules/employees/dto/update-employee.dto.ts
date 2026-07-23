import {
  ClearanceLevel,
  EmployeeTitle,
  EmploymentStatus,
  EmploymentType,
  Gender,
  UpdateEmployeeRequest,
} from "@orelia/common";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

// Story 1.4 (Update Employee Record). Tri-state per field: absent = leave
// unchanged, null = clear, value = set (see UpdateEmployeeRequest's contract
// comment). @IsOptional() skips validation for both undefined AND null, so
// `field?: T | null` needs no extra decorator to allow clearing. fullName is
// the one field that can never be null -- an employee always has a name --
// though it may be absent (unchanged).
export class UpdateEmployeeDto implements UpdateEmployeeRequest {
  // Personal
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsString()
  nationality?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string | null;

  // Employment
  @IsOptional()
  @IsString()
  employeeCode?: string | null;

  @IsOptional()
  @IsEnum(EmployeeTitle)
  title?: EmployeeTitle | null;

  @IsOptional()
  @IsString()
  currentDesignation?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType | null;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus | null;

  @IsOptional()
  @IsDateString()
  dateOfJoined?: string | null;

  @IsOptional()
  @IsString()
  primaryLocation?: string | null;

  @IsOptional()
  @IsString()
  baseCountry?: string | null;

  @IsOptional()
  @IsEnum(ClearanceLevel)
  clearanceLevel?: ClearanceLevel | null;

  @IsOptional()
  @IsString()
  cvUrl?: string | null;

  // Contact
  @IsOptional()
  @IsEmail()
  employeeEmail?: string | null;

  @IsOptional()
  @IsString()
  mobileNo?: string | null;

  @IsOptional()
  @IsString()
  officeNo?: string | null;

  // Confidential -- EMPLOYEES_VIEW_SENSITIVE only; `delete`d in the
  // controller for a caller without it, so these keys are absent (not
  // undefined-valued) by the time the service assigns/diffs fields.
  @IsOptional()
  @IsString()
  nicPassportNumber?: string | null;

  @IsOptional()
  @IsNumber()
  baseSalary?: number | null;
}
