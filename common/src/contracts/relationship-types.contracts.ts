export interface RelationshipTypeResponse {
  id: string;
  name: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRelationshipTypeRequest {
  name: string;
}

export interface UpdateRelationshipTypeRequest {
  name?: string;
}
