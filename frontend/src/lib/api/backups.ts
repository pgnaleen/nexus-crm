import { apiFetch } from "./client";

export function runBackup(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/db-backup/run", { method: "POST" });
}
