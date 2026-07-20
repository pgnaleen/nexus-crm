import type {
  CompanyPickerResponse,
  ContactPickerResponse,
  EmployeePickerResponse,
  IndustryResponse,
} from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listIndustries(): Promise<IndustryResponse[] | null> {
  return serverFetch<IndustryResponse[]>("/industries");
}

export function listEmployeesPicker(): Promise<EmployeePickerResponse[] | null> {
  return serverFetch<EmployeePickerResponse[]>("/employees/picker");
}

export function listCompaniesPicker(): Promise<CompanyPickerResponse[] | null> {
  return serverFetch<CompanyPickerResponse[]>("/companies/picker");
}

export function listContactsPicker(): Promise<ContactPickerResponse[] | null> {
  return serverFetch<ContactPickerResponse[]>("/contacts/picker");
}
