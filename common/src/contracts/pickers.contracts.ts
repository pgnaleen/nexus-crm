export interface EmployeePickerResponse {
  id: string;
  fullName: string;
}

export interface CompanyPickerResponse {
  id: string;
  name: string;
}

export interface ContactPickerResponse {
  id: string;
  fullName: string;
  companyId?: string | null;
}

export interface UploadResponse {
  url: string;
}
