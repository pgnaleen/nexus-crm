import type {
  ActingTenant,
  AuthSessionResponse,
  LoginRequest,
  VerifyPasswordResponse,
} from "@orelia/common";
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

export function actAsTenant(tenantId: string): Promise<{ tenant: ActingTenant }> {
  return apiFetch<{ tenant: ActingTenant }>("/auth/act-as-tenant", {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });
}

export function exitActAsTenant(): Promise<void> {
  return apiFetch<void>("/auth/exit-act-as-tenant", { method: "POST" });
}

export function verifyPassword(password: string): Promise<VerifyPasswordResponse> {
  return apiFetch<VerifyPasswordResponse>("/auth/verify-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
