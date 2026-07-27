import { BadRequestException } from "@nestjs/common";

// Bucket layout: every tenant gets its own top-level folder named after its
// slug (readable in the S3 console, unlike a bare uuid), with these
// sub-folders inside it holding each file type. The nightly DB-backup dumps
// (see db-backup.service.ts) live under their own top-level "backups/orelia/"
// folder, a sibling of every tenant folder, never nested inside one -- e.g.:
//   {bucket}/acme-corp/logos/{uuid}.png
//   {bucket}/acme-corp/deal-documents/{dealId}/{uuid}.pdf
//   {bucket}/backups/orelia/orelia-{timestamp}.dump
// The "orelia/" segment under backups keeps this app's dumps in their own
// namespace even if the bucket is ever shared with another project's own
// top-level folder -- this bucket once shared a bare "db-backups/" prefix
// with a predecessor project, and an age-based retention prune swept up and
// permanently deleted that project's dumps because the prefixes collided.
export const LOGO_SEGMENT = "logos/";
export const EMPLOYEE_PHOTO_SEGMENT = "employee-photos/";
export const EMPLOYEE_CV_SEGMENT = "employee-cvs/";
export const CERTIFICATION_SEGMENT = "certifications/";
export const DEAL_DOCUMENTS_SEGMENT = "deal-documents/";

// How long a signed GET URL stays valid. Objects are private (no public-read
// bucket policy) -- every response that surfaces a file link generates one of
// these fresh from the stored key rather than persisting a URL anywhere, so
// there's nothing long-lived to leak via browser history/logs/copy-paste.
export const SIGNED_URL_EXPIRES_IN_SECONDS = 300;

// e.g. tenantKeyPrefix("acme-corp", LOGO_SEGMENT) -> "acme-corp/logos/" --
// tenantSlug is validated at tenant-creation time (lowercase alphanumeric +
// hyphens only, see CreateTenantDto), so it's always a safe path segment.
export function tenantKeyPrefix(tenantSlug: string, typeSegment: string): string {
  return `${tenantSlug}/${typeSegment}`;
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
export function assertKeyBelongsToTenant(key: string, typeSegment: string, tenantSlug: string): void {
  if (!key.startsWith(tenantKeyPrefix(tenantSlug, typeSegment))) {
    throw new BadRequestException("This file does not belong to the current tenant");
  }
}
