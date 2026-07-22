import type { CompanyPickerResponse, ContactPickerResponse, EmployeePickerResponse } from "@orelia/common";
import { apiFetch } from "./client";

export function listCompaniesPicker(): Promise<CompanyPickerResponse[]> {
  return apiFetch<CompanyPickerResponse[]>("/pickers/companies");
}

export function listContactsPicker(): Promise<ContactPickerResponse[]> {
  return apiFetch<ContactPickerResponse[]>("/pickers/contacts");
}

export function listEmployeesPicker(): Promise<EmployeePickerResponse[]> {
  return apiFetch<EmployeePickerResponse[]>("/pickers/employees");
}
