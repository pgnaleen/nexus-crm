export interface RelationshipTypeResponse {
  id: string;
  name: string;
  tenantId: string;
  /** Active (non-deleted) Company/Contact rows tagged under this type -- deleting it cascades to these. */
  dependentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRelationshipTypeRequest {
  name: string;
}

export interface UpdateRelationshipTypeRequest {
  name?: string;
}
