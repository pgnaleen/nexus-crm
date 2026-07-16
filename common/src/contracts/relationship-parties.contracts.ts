import { CompanyResponse } from "./companies.contracts";
import { ContactResponse } from "./contacts.contracts";

export type RelationshipPartyKind = "company" | "contact";

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
