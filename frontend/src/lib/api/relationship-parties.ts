import type {
  CreateContactRequest,
  CreateRelationshipPartyCompanyRequest,
  RelationshipPartyResponse,
  UpdateCompanyRequest,
  UpdateContactRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function listRelationshipParties(
  relationshipTypeId: string,
): Promise<RelationshipPartyResponse[]> {
  return apiFetch<RelationshipPartyResponse[]>(`/relationship-types/${relationshipTypeId}/parties`);
}

export function createRelationshipPartyCompany(
  relationshipTypeId: string,
  payload: CreateRelationshipPartyCompanyRequest,
): Promise<RelationshipPartyResponse> {
  return apiFetch<RelationshipPartyResponse>(
    `/relationship-types/${relationshipTypeId}/parties/companies`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function createRelationshipPartyContact(
  relationshipTypeId: string,
  payload: CreateContactRequest,
): Promise<RelationshipPartyResponse> {
  return apiFetch<RelationshipPartyResponse>(
    `/relationship-types/${relationshipTypeId}/parties/contacts`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function updateRelationshipPartyCompany(
  relationshipTypeId: string,
  mapId: string,
  payload: UpdateCompanyRequest,
): Promise<RelationshipPartyResponse> {
  return apiFetch<RelationshipPartyResponse>(
    `/relationship-types/${relationshipTypeId}/parties/companies/${mapId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function updateRelationshipPartyContact(
  relationshipTypeId: string,
  mapId: string,
  payload: UpdateContactRequest,
): Promise<RelationshipPartyResponse> {
  return apiFetch<RelationshipPartyResponse>(
    `/relationship-types/${relationshipTypeId}/parties/contacts/${mapId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function disableRelationshipParty(
  relationshipTypeId: string,
  mapId: string,
): Promise<RelationshipPartyResponse> {
  return apiFetch<RelationshipPartyResponse>(
    `/relationship-types/${relationshipTypeId}/parties/${mapId}/disable`,
    { method: "PATCH" },
  );
}

export function enableRelationshipParty(
  relationshipTypeId: string,
  mapId: string,
): Promise<RelationshipPartyResponse> {
  return apiFetch<RelationshipPartyResponse>(
    `/relationship-types/${relationshipTypeId}/parties/${mapId}/enable`,
    { method: "PATCH" },
  );
}

export function deleteRelationshipParty(
  relationshipTypeId: string,
  mapId: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/relationship-types/${relationshipTypeId}/parties/${mapId}`, {
    method: "DELETE",
  });
}
