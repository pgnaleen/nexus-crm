import {
  ClearanceLevel,
  CreateEmployeeRequest,
  EmployeeTitle,
  EmploymentStatus,
  EmploymentType,
  Gender,
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

export class CreateEmployeeDto implements CreateEmployeeRequest {
  // Personal
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  // Employment
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsEnum(EmployeeTitle)
  title?: EmployeeTitle;

  @IsOptional()
  @IsString()
  currentDesignation?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsDateString()
  dateOfJoined?: string;

  @IsOptional()
  @IsString()
  primaryLocation?: string;

  @IsOptional()
  @IsString()
  baseCountry?: string;

  @IsOptional()
  @IsEnum(ClearanceLevel)
  clearanceLevel?: ClearanceLevel;

  @IsOptional()
  @IsString()
  cvUrl?: string;

  // Contact
  @IsOptional()
  @IsEmail()
  employeeEmail?: string;

  @IsOptional()
  @IsString()
  mobileNo?: string;

  @IsOptional()
  @IsString()
  officeNo?: string;

  // Confidential -- EMPLOYEES_VIEW_SENSITIVE only, enforced/stripped in the service
  @IsOptional()
  @IsString()
  nicPassportNumber?: string;

  @IsOptional()
  @IsNumber()
  baseSalary?: number;
}
