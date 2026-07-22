export interface EmployeePickerResponse {
  id: string;
  fullName: string;
}

export interface CompanyPickerResponse {
  id: string;
  name: string;
  country?: string | null;
}

export interface ContactPickerResponse {
  id: string;
  fullName: string;
  companyId?: string | null;
}

export interface DepartmentPickerResponse {
  id: string;
  name: string;
}

export interface UploadResponse {
  url: string;
}
