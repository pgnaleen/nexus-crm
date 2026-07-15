import { RoleBuying } from "../enums";
import { IContact } from "../types";

export interface CreateContactRequest {
  companyId: string;
  fullName: string;
  title?: string;
  department?: string;
  roleBuying?: RoleBuying;
  email?: string;
  mobileNo?: string;
  directPhoneNo?: string;
  linkedIn?: string;
  country?: string;
  timezone?: string;
  userId?: string;
}

export type UpdateContactRequest = Partial<Omit<CreateContactRequest, "companyId">>;

export type ContactResponse = IContact;
