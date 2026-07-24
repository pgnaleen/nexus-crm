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

// Any active user in the tenant -- Priority Tracker's Share/Delegate
// pickers (Stories 1.5/1.6), gated on "authenticated" only, matching
// Priority Tasks' own no-RBAC-permission access model.
export interface UserPickerResponse {
  id: string;
  displayName: string;
}

export interface UploadResponse {
  url: string;
}

/** Companies/contacts tagged under whichever Relationship Type a tenant has flagged
 * as its Customer or Partner system role. `configured: false` means the tenant hasn't
 * flagged a type for this role yet -- distinct from `configured: true` with empty arrays,
 * which means a type is flagged but nothing's tagged under it yet. */
export interface RelationshipRolePickerResponse {
  configured: boolean;
  companies: CompanyPickerResponse[];
  contacts: ContactPickerResponse[];
}
