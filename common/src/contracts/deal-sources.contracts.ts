import { DealSourceCategory } from "../enums";
import { IDealSource } from "../types";

export type DealSourceResponse = IDealSource & {
  createdAt: string;
  updatedAt: string;
};

export interface CreateDealSourceRequest {
  name: string;
  category?: DealSourceCategory;
  isActive?: boolean;
}

export interface UpdateDealSourceRequest {
  name?: string;
  // null explicitly clears the category; undefined/omitted leaves it untouched.
  category?: DealSourceCategory | null;
  isActive?: boolean;
}
