import { UserStatus } from "../enums";

export interface IUser {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  status: UserStatus;
  loggingEmail: string;
  lastLoggingAt?: string | null;
  mustChangePassword: boolean;
}
