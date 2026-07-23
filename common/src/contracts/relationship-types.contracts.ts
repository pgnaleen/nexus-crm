import type { SystemRole } from "../enums";

export interface RelationshipTypeResponse {
  id: string;
  name: string;
  tenantId: string;
  /** Active (non-deleted) Company/Contact rows tagged under this type -- deleting it cascades to these. */
  dependentCount: number;
  /** Flags this type as the tenant's Customer or Partner type for Deal pickers, or null if unflagged. */
  systemRole: SystemRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRelationshipTypeRequest {
  name: string;
  systemRole?: SystemRole | null;
}

export interface UpdateRelationshipTypeRequest {
  name?: string;
  systemRole?: SystemRole | null;
}
