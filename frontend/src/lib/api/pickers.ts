import type { CompanyPickerResponse, ContactPickerResponse, EmployeePickerResponse } from "@orelia/common";
import { apiFetch } from "./client";

export function listCompaniesPicker(): Promise<CompanyPickerResponse[]> {
  return apiFetch<CompanyPickerResponse[]>("/companies/picker");
}

export function listContactsPicker(): Promise<ContactPickerResponse[]> {
  return apiFetch<ContactPickerResponse[]>("/contacts/picker");
}

export function listEmployeesPicker(): Promise<EmployeePickerResponse[]> {
  return apiFetch<EmployeePickerResponse[]>("/employees/picker");
}
