import { RoleBuying } from "../enums";
import { IContact } from "../types";

export interface CreateContactRequest {
  companyId?: string;
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

export interface UpdateContactRequest {
  companyId?: string;
  fullName?: string;
  title?: string;
  department?: string;
  // null explicitly clears the role; undefined/omitted leaves it untouched.
  roleBuying?: RoleBuying | null;
  email?: string;
  mobileNo?: string;
  directPhoneNo?: string;
  linkedIn?: string;
  country?: string;
  timezone?: string;
  userId?: string;
}

export type ContactResponse = IContact;
