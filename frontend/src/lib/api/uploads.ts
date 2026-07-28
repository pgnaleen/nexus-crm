import type { UploadResponse } from "@orelia/common";
import { ApiError } from "./client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// displayName is whatever the calling form already has typed in (company
// name, employee full name, certification name) -- these 4 uploads happen
// before the owning record exists, so it's the only source of a
// human-readable S3 key the backend has. Optional: the file may be picked
// before the name field is filled in, and the backend falls back gracefully
// (original filename, then a generic label) when it's omitted.

// Not routed through apiFetch -- that helper always sets
// Content-Type: application/json, which would break the multipart boundary
// the browser needs to set itself for a FormData body.
export async function uploadLogo(file: File, displayName?: string): Promise<UploadResponse> {
  return uploadFile(file, "logo", "Failed to upload logo", displayName);
}

export async function uploadEmployeePhoto(file: File, displayName?: string): Promise<UploadResponse> {
  return uploadFile(file, "employee-photo", "Failed to upload photo", displayName);
}

export async function uploadEmployeeCv(file: File, displayName?: string): Promise<UploadResponse> {
  return uploadFile(file, "employee-cv", "Failed to upload CV", displayName);
}

// Story 1.12 -- certificate evidence for a self-reported certification.
export async function uploadCertification(file: File, displayName?: string): Promise<UploadResponse> {
  return uploadFile(file, "certification", "Failed to upload certificate", displayName);
}

// Own profile photo, uploaded from My Profile. Distinct from
// uploadEmployeePhoto above: that route is gated on EMPLOYEES_CREATE/UPDATE
// because the Employee form can target anyone, and a self-service user holds
// neither. Same limits, different guard.
export async function uploadMyPhoto(file: File, displayName?: string): Promise<UploadResponse> {
  return uploadFile(file, "my-photo", "Failed to upload photo", displayName);
}

async function uploadFile(
  file: File,
  route: string,
  errorMessage: string,
  displayName?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (displayName?.trim()) {
    formData.append("displayName", displayName.trim());
  }

  const res = await fetch(`${API_BASE_URL}/api/uploads/${route}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? errorMessage, res.status);
  }

  return res.json() as Promise<UploadResponse>;
}
