import type {
  CreateRelationshipTypeRequest,
  RelationshipTypeResponse,
  UpdateRelationshipTypeRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function createRelationshipType(payload: CreateRelationshipTypeRequest): Promise<RelationshipTypeResponse> {
  return apiFetch<RelationshipTypeResponse>("/relationship-types", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRelationshipType(id: string, payload: UpdateRelationshipTypeRequest): Promise<RelationshipTypeResponse> {
  return apiFetch<RelationshipTypeResponse>(`/relationship-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteRelationshipType(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/relationship-types/${id}`, { method: "DELETE" });
}

export function listRelationshipTypes(): Promise<RelationshipTypeResponse[]> {
  return apiFetch<RelationshipTypeResponse[]>("/relationship-types");
}
