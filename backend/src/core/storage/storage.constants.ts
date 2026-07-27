import { BadRequestException } from "@nestjs/common";

// Shared app bucket also holds the nightly DB-backup dumps under
// "db-backups/orelia/" (see db-backup.service.ts) -- this prefix keeps every
// user-uploaded file in its own distinct namespace so an age-based retention
// prune (or any other bucket-wide job) can never mistake one feature's
// objects for another's, the exact mistake that once deleted a different
// project's backups sharing this same bucket.
export const UPLOADS_PREFIX = "uploads/";

export const LOGO_PREFIX = `${UPLOADS_PREFIX}logos/`;
export const EMPLOYEE_PHOTO_PREFIX = `${UPLOADS_PREFIX}employee-photos/`;
export const EMPLOYEE_CV_PREFIX = `${UPLOADS_PREFIX}employee-cvs/`;
export const CERTIFICATION_PREFIX = `${UPLOADS_PREFIX}certifications/`;
export const DEAL_DOCUMENTS_PREFIX = `${UPLOADS_PREFIX}deal-documents/`;

// How long a signed GET URL stays valid. Objects are private (no public-read
// bucket policy) -- every response that surfaces a file link generates one of
// these fresh from the stored key rather than persisting a URL anywhere, so
// there's nothing long-lived to leak via browser history/logs/copy-paste.
export const SIGNED_URL_EXPIRES_IN_SECONDS = 300;

// Every key under one of the five type prefixes above is further namespaced
// by tenant id -- e.g. "uploads/logos/{tenantId}/{uuid}.png" -- so a key
// path can never collide with (or be mistaken for) another tenant's file.
export function tenantKeyPrefix(typePrefix: string, tenantId: string): string {
  return `${typePrefix}${tenantId}/`;
}

// Guards every client-supplied key (Company.logo, Employee.profilePhotoUrl/
// s3Key (cvUrl), EmployeeCertification.evidenceFileUrl -- these are plain
// strings on their DTOs, not re-derived server-side) before it's ever
// persisted or used to generate a signed URL. Deal documents don't need this
// -- their s3Key is always computed server-side from the just-uploaded file,
// never taken from client input. Without this check here, nothing would stop
// one tenant from pointing their own record at another tenant's real key (if
// it ever leaked outside the app) and getting a valid signed URL for it --
// every other table in this app enforces tenant isolation at the data layer
// (tenant_id + TenantContextService); this is that same guarantee for keys.
export function assertKeyBelongsToTenant(key: string, typePrefix: string, tenantId: string): void {
  if (!key.startsWith(tenantKeyPrefix(typePrefix, tenantId))) {
    throw new BadRequestException("This file does not belong to the current tenant");
  }
}
