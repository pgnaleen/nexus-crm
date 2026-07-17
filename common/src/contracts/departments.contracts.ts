export interface DepartmentResponse {
  id: string;
  name: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentRequest {
  name: string;
  isActive?: boolean;
}

export interface UpdateDepartmentRequest {
  name?: string;
  isActive?: boolean;
}
