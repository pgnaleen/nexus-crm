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
