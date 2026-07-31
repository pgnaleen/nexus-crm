import { CompanyResponse, CreateCompanyRequest } from "./companies.contracts";
import { ContactResponse, CreateContactRequest } from "./contacts.contracts";

export type RelationshipPartyKind = "company" | "contact";

// Contacts added alongside a new company are created atomically with it in
// a single request/transaction, with companyId pointing at the new company.
// They do NOT become independent parties of their own -- they're already
// covered by the company's own party row, so giving them one too would
// double-count them as independent top-level entries for this relationship
// type (fixed 2026-07-22).
export interface CreateRelationshipPartyCompanyRequest extends CreateCompanyRequest {
  contacts?: CreateContactRequest[];
}

export interface RelationshipPartyResponse {
  id: string;
  relationshipTypeId: string;
  kind: RelationshipPartyKind;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company: CompanyResponse | null;
  contact: ContactResponse | null;
}

// Cross-relationship-type tag summary for a single Company/Contact -- used
// by the Relationships tab (RelationshipHubDiagram) to show every type a
// party is tagged under, active or disabled, in one call instead of
// fetching each relationship type's own /parties list and filtering
// client-side. `mapId` is the relationship_company_contact_map row id
// (needed to target enable/disable/remove later if that's ever surfaced
// here); `relationshipTypeName` is resolved server-side so the frontend
// never needs a second lookup just to label a spoke.
export interface RelationshipTagResponse {
  mapId: string;
  relationshipTypeId: string;
  relationshipTypeName: string;
  isActive: boolean;
}

export interface AddRelationshipTagRequest {
  relationshipTypeId: string;
}
