import type { RelationshipPartyResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listRelationshipParties(
  relationshipTypeId: string,
): Promise<RelationshipPartyResponse[] | null> {
  return serverFetch<RelationshipPartyResponse[]>(`/relationship-types/${relationshipTypeId}/parties`);
}
