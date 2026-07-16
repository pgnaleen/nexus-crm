import type { RelationshipTypeResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listRelationshipTypes(): Promise<RelationshipTypeResponse[] | null> {
  return serverFetch<RelationshipTypeResponse[]>("/relationship-types");
}
