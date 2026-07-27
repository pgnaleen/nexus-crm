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
