import { cookies } from "next/headers";
import { cache } from "react";
import { extractCookieValue, getSetCookieValues, withCookie } from "../auth/cookie-utils";

// Server-only fetch helper — runs inside the Next.js server process (Server
// Components), which must reach the backend via the internal Docker service
// hostname rather than NEXT_PUBLIC_API_URL (that one is for browser fetches).
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
const ACCESS_COOKIE = "orelia_access_token";
const REFRESH_COOKIE = "orelia_refresh_token";

function getCookieHeader(): string {
  return cookies()
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

// middleware.ts already refreshes proactively before a page renders, based on
// decoding the access token's exp claim -- this covers the case that slips
// past that check (token rejected for a reason other than plain expiry, e.g.
// revoked or a clock skew edge case). Without this, serverFetch used to just
// return null on any 401, silently rendering the page with no data until the
// user manually refreshed and got a fresh middleware pass.
//
// Wrapped in React's cache() so multiple Server Components hitting a 401 on
// the same page render share one refresh attempt instead of each rotating
// the refresh token out from under the others. cache() memoizes per request,
// not across users/requests, so this can't leak between different sessions.
const refreshAccessToken = cache(async (): Promise<string | null> => {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${API_INTERNAL_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
  });
  if (!res.ok) return null;

  return extractCookieValue(getSetCookieValues(res.headers), ACCESS_COOKIE);
});

export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const method = init?.method ?? "GET";
  const startedAt = Date.now();

  const doFetch = (freshAccessToken?: string) => {
    const cookieHeader = freshAccessToken
      ? withCookie(getCookieHeader(), ACCESS_COOKIE, freshAccessToken)
      : getCookieHeader();
    return fetch(`${API_INTERNAL_URL}/api${path}`, {
      ...init,
      headers: {
        cookie: cookieHeader,
        ...init?.headers,
      },
      cache: "no-store",
    });
  };

  try {
    let res = await doFetch();

    if (res.status === 401) {
      console.log(`[serverFetch] ${method} ${path} -> 401, attempting token refresh`);
      const freshAccessToken = await refreshAccessToken();
      if (freshAccessToken) {
        console.log(`[serverFetch] ${method} ${path} -> refresh succeeded, retrying request`);
        res = await doFetch(freshAccessToken);
      } else {
        console.log(`[serverFetch] ${method} ${path} -> refresh failed, returning null`);
      }
    }

    const duration = Date.now() - startedAt;

    if (!res.ok) {
      console.error(`[serverFetch] ${method} ${path} ${res.status} ${duration}ms`);
      return null;
    }

    console.log(`[serverFetch] ${method} ${path} ${res.status} ${duration}ms`);
    return res.json() as Promise<T>;
  } catch (err) {
    const duration = Date.now() - startedAt;
    console.error(`[serverFetch] ${method} ${path} failed after ${duration}ms: ${(err as Error).message}`);
    throw err;
  }
}
