// Shared by middleware.ts (proactive refresh before a page renders) and
// server-client.ts (reactive refresh-and-retry when a Server Component fetch
// still comes back 401) -- both need to read Set-Cookie values off a raw
// fetch Response and splice a single cookie into an existing Cookie header.

// Modern fetch implementations expose Headers.getSetCookie() for the
// multi-value case; fall back to a comma-split that only breaks at a
// following "name=" boundary (Set-Cookie's Expires attribute also contains
// commas, e.g. "Expires=Wed, 21 Oct 2026 ...", so a naive split is unsafe).
export function splitSetCookieHeader(combined: string): string[] {
  return combined.split(/,(?=\s*[\w.-]+=)/);
}

export function getSetCookieValues(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  return typeof getSetCookie === "function"
    ? getSetCookie.call(headers)
    : splitSetCookieHeader(headers.get("set-cookie") ?? "");
}

export function extractCookieValue(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const pair = header.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq !== -1 && pair.slice(0, eq).trim() === name) {
      return pair.slice(eq + 1).trim();
    }
  }
  return null;
}

export function withCookie(cookieHeader: string, name: string, value: string): string {
  const parts = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith(`${name}=`));
  parts.push(`${name}=${value}`);
  return parts.join("; ");
}
