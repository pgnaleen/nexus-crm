import type {
  CompanyPickerResponse,
  ContactPickerResponse,
  DepartmentPickerResponse,
  EmployeePickerResponse,
  IndustryResponse,
  RelationshipRolePickerResponse,
} from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listIndustries(): Promise<IndustryResponse[] | null> {
  return serverFetch<IndustryResponse[]>("/pickers/industries");
}

export function listEmployeesPicker(): Promise<EmployeePickerResponse[] | null> {
  return serverFetch<EmployeePickerResponse[]>("/pickers/employees");
}

export function listCompaniesPicker(): Promise<CompanyPickerResponse[] | null> {
  return serverFetch<CompanyPickerResponse[]>("/pickers/companies");
}

export function listCompanyCountries(): Promise<string[] | null> {
  return serverFetch<string[]>("/pickers/company-countries");
}

export function listContactsPicker(): Promise<ContactPickerResponse[] | null> {
  return serverFetch<ContactPickerResponse[]>("/pickers/contacts");
}

export function listDepartmentsPicker(): Promise<DepartmentPickerResponse[] | null> {
  return serverFetch<DepartmentPickerResponse[]>("/pickers/departments");
}

export function listDealCustomerParties(): Promise<RelationshipRolePickerResponse | null> {
  return serverFetch<RelationshipRolePickerResponse>("/pickers/deal-customer-parties");
}

export function listDealPartnerParties(): Promise<RelationshipRolePickerResponse | null> {
  return serverFetch<RelationshipRolePickerResponse>("/pickers/deal-partner-parties");
}
