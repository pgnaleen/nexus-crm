import type { AuthSessionResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

/**
 * Server-side session lookup. Also enforces the URL tenant slug matches the
 * session's real tenant, so a user can't be shown another tenant's shell by
 * editing the URL.
 */
export async function getServerSession(tenantSlug: string): Promise<AuthSessionResponse | null> {
  const session = await serverFetch<AuthSessionResponse>("/auth/me");

  if (!session || session.tenant.slug !== tenantSlug) {
    return null;
  }

  return session;
}
