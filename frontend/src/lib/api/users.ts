import type { ChangeOwnPasswordRequest, CreateUserRequest, CreateUserResponse, ResetPasswordRequest, UpdateUserRequest, UserResponse } from "@orelia/common";
import { apiFetch } from "./client";

export function getUser(id: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/users/${id}`);
}

export function getUserRoleIds(id: string): Promise<string[]> {
  return apiFetch<string[]>(`/users/${id}/roles`);
}

export function resetUserPassword(id: string, payload: ResetPasswordRequest): Promise<void> {
  return apiFetch<void>(`/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Returns CreateUserResponse, not UserResponse -- the extra `welcomeEmail`
// field reports whether the temporary password actually reached the new user.
// A 201 here means "the account row exists", NOT "they can log in": callers
// must check welcomeEmail.sent and tell the admin when it's false.
export function createUser(payload: CreateUserRequest): Promise<CreateUserResponse> {
  return apiFetch<CreateUserResponse>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: string, payload: UpdateUserRequest): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/users/${id}`, { method: "DELETE" });
}

export function disableUser(id: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/users/${id}/disable`, { method: "PATCH" });
}

export function enableUser(id: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/users/${id}/enable`, { method: "PATCH" });
}

export function changeOwnPassword(payload: ChangeOwnPasswordRequest): Promise<void> {
  return apiFetch<void>("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
