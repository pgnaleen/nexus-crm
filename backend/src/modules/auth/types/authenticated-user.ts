export interface AuthenticatedUser {
  sub: string;
  tenantId: string;
  roles: string[];
}
