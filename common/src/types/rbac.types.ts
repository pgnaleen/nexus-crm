import { RbacRiskLevel } from "../enums";

export interface IRbacResource {
  id: string;
  name: string;
  description?: string | null;
  riskLevel: RbacRiskLevel;
  isPlatformOnly: boolean;
}

export interface IRbacRole {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
}
