// Size limits and MIME allowlists for every upload type. Storage location
// (S3 bucket/key prefix) lives in core/storage/storage.constants.ts -- these
// two used to be combined here when uploads went to local disk; kept
// separate now since size/MIME rules are upload-feature concerns, storage
// location is a core/infra concern.
export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export const MAX_DEAL_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_DEAL_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const MAX_EMPLOYEE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EMPLOYEE_PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const MAX_EMPLOYEE_CV_SIZE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EMPLOYEE_CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Story 1.12 -- certificate evidence an employee attaches to a self-reported
// certification. A scanned certificate is typically a PDF or an image.
export const MAX_CERTIFICATION_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_CERTIFICATION_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
