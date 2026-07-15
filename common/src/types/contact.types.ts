import { RoleBuying } from "../enums";

export interface IContact {
  id: string;
  tenantId: string;
  companyId?: string | null;
  fullName: string;
  title?: string | null;
  department?: string | null;
  roleBuying?: RoleBuying | null;
  email?: string | null;
  mobileNo?: string | null;
  directPhoneNo?: string | null;
  linkedIn?: string | null;
  preferredChannels?: string[] | null;
  languages?: string[] | null;
  country?: string | null;
  timezone?: string | null;
  relationshipOwner?: string | null;
  photoUrl?: string | null;
  dob?: string | null;
  userId?: string | null;
}
