import type {
  CompanyPickerResponse,
  ContactPickerResponse,
  EmployeePickerResponse,
  RelationshipRolePickerResponse,
} from "@orelia/common";
import { apiFetch } from "./client";

export function listCompaniesPicker(): Promise<CompanyPickerResponse[]> {
  return apiFetch<CompanyPickerResponse[]>("/pickers/companies");
}

export function listContactsPicker(): Promise<ContactPickerResponse[]> {
  return apiFetch<ContactPickerResponse[]>("/pickers/contacts");
}

export function listDealCustomerParties(): Promise<RelationshipRolePickerResponse> {
  return apiFetch<RelationshipRolePickerResponse>("/pickers/deal-customer-parties");
}

export function listDealPartnerParties(): Promise<RelationshipRolePickerResponse> {
  return apiFetch<RelationshipRolePickerResponse>("/pickers/deal-partner-parties");
}

export function listEmployeesPicker(): Promise<EmployeePickerResponse[]> {
  return apiFetch<EmployeePickerResponse[]>("/pickers/employees");
}
