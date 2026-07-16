import type { CreateUserRequest, UpdateUserRequest, UserResponse } from "@orelia/common";
import { apiFetch } from "./client";

export function getUser(id: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/users/${id}`);
}

export function createUser(payload: CreateUserRequest): Promise<UserResponse> {
  return apiFetch<UserResponse>("/users", {
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
