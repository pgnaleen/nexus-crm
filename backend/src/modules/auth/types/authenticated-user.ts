export interface AuthenticatedUser {
  sub: string;
  tenantId: string;
  // Carried alongside tenantId so S3 key generation (tenant-slug-first
  // bucket layout, see storage.constants.ts) never needs its own DB lookup
  // -- every JWT-issuing call site already has the full Tenant row loaded.
  tenantSlug: string;
  roles: string[];
}
