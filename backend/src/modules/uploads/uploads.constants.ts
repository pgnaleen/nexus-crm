// Relative to the backend package's cwd. A named volume should be mounted
// over this path in production so uploads survive container recreation.
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
export const LOGO_SUBDIR = "logos";
export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export const DEAL_DOCUMENTS_SUBDIR = "deal-documents";
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

export const EMPLOYEE_PHOTO_SUBDIR = "employee-photos";
export const MAX_EMPLOYEE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EMPLOYEE_PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const EMPLOYEE_CV_SUBDIR = "employee-cvs";
export const MAX_EMPLOYEE_CV_SIZE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EMPLOYEE_CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
