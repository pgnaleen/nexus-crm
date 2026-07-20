import { createHash } from "node:crypto";

// Refresh tokens are stored hashed, never in plaintext -- shared so any
// module that needs to look one up (matching against the DB) hashes it
// exactly the way AuthService does when it first issues/persists one.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
