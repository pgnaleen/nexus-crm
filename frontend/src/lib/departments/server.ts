import type { DepartmentResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listDepartments(): Promise<DepartmentResponse[] | null> {
  return serverFetch<DepartmentResponse[]>("/departments");
}
