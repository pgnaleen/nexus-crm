import type { AuthSessionResponse, LoginRequest } from "@orelia/common";
import { apiFetch } from "./client";

export function login(payload: LoginRequest): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function me(): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>("/auth/me");
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}
