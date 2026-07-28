import { randomUUID } from "crypto";

// Turns an arbitrary display name (deal name, company name, employee full
// name, certification name, or an uploaded file's original filename) into a
// safe, readable S3 key segment. Unicode-aware (letters/numbers from any
// script survive, not just ASCII) so a name like "Société Générale" stays
// legible rather than being reduced to nothing. `/`, `\`, and ".." are
// stripped explicitly even though the character allowlist already excludes
// them -- defense in depth, since this becomes a path segment and
// `displayName` is client-controlled for the uploads.controller.ts routes.
export function sanitizeKeySegment(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/[^\p{L}\p{N}\- _.]/gu, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, maxLength);
}

// Always appends a short random tag, on every fallback tier -- two records
// sharing a display name (two companies both called "Acme") land as
// `Acme-a1b2c3d4` and `Acme-9f0e1d2c`, both legible, both guaranteed
// unique. Never falls back to a bare UUID (defeats the point of naming
// things), never allows a silent overwrite-by-collision either.
export function withUniqueSuffix(base: string, fallback: string): string {
  const suffix = randomUUID().slice(0, 8);
  return base ? `${base}-${suffix}` : `${fallback}-${suffix}`;
}
