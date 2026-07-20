import type { UploadResponse } from "@orelia/common";
import { ApiError } from "./client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Upload responses return a backend-relative path (e.g. "/uploads/logos/x.png")
// -- the backend serves it directly, not through the "api" prefix.
export function resolveUploadUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Not routed through apiFetch -- that helper always sets
// Content-Type: application/json, which would break the multipart boundary
// the browser needs to set itself for a FormData body.
export async function uploadLogo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/uploads/logo`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? "Failed to upload logo", res.status);
  }

  return res.json() as Promise<UploadResponse>;
}