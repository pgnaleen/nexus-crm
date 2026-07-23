import type {
  ActingTenant,
  AuthSessionResponse,
  LoginRequest,
  VerifyPasswordResponse,
} from "@orelia/common";
import { announceAuthChange } from "@/lib/auth/tab-sync";
import { apiFetch } from "./client";

export async function login(payload: LoginRequest): Promise<AuthSessionResponse> {
  const session = await apiFetch<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // Tells every OTHER open tab to reload -- see lib/auth/tab-sync.ts.
  announceAuthChange();
  return session;
}

export function me(): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>("/auth/me");
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
  announceAuthChange();
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
