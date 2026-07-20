import { CompanyResponse, CreateCompanyRequest } from "./companies.contracts";
import { ContactResponse, CreateContactRequest } from "./contacts.contracts";

export type RelationshipPartyKind = "company" | "contact";

// Contacts added alongside a new company are created atomically with it in
// a single request/transaction, each becoming its own party too (tagged to
// the same relationship type, with companyId pointing at the new company).
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
