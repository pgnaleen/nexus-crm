import type {
  AddRelationshipTagRequest,
  ContactResponse,
  CreateContactRequest,
  CreateRelationshipPartyCompanyRequest,
  RelationshipPartyResponse,
  RelationshipTagResponse,
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

export function listCompanyContacts(
  relationshipTypeId: string,
  mapId: string,
): Promise<ContactResponse[]> {
  return apiFetch<ContactResponse[]>(
    `/relationship-types/${relationshipTypeId}/parties/companies/${mapId}/contacts`,
  );
}

export function updateCompanyContact(
  relationshipTypeId: string,
  mapId: string,
  contactId: string,
  payload: UpdateContactRequest,
): Promise<ContactResponse> {
  return apiFetch<ContactResponse>(
    `/relationship-types/${relationshipTypeId}/parties/companies/${mapId}/contacts/${contactId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function deleteCompanyContact(
  relationshipTypeId: string,
  mapId: string,
  contactId: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(
    `/relationship-types/${relationshipTypeId}/parties/companies/${mapId}/contacts/${contactId}`,
    { method: "DELETE" },
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

// Cross-relationship-type tags (Relationships tab) -- keyed by the real
// Company/Contact id, not a single-type mapId, since a party's tags span
// every relationship type it's tagged under.
export function listCompanyTags(companyId: string): Promise<RelationshipTagResponse[]> {
  return apiFetch<RelationshipTagResponse[]>(`/relationship-parties/companies/${companyId}/tags`);
}

export function addCompanyTag(
  companyId: string,
  payload: AddRelationshipTagRequest,
): Promise<RelationshipTagResponse> {
  return apiFetch<RelationshipTagResponse>(`/relationship-parties/companies/${companyId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listContactTags(contactId: string): Promise<RelationshipTagResponse[]> {
  return apiFetch<RelationshipTagResponse[]>(`/relationship-parties/contacts/${contactId}/tags`);
}

export function addContactTag(
  contactId: string,
  payload: AddRelationshipTagRequest,
): Promise<RelationshipTagResponse> {
  return apiFetch<RelationshipTagResponse>(`/relationship-parties/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
