import { NextRequest, NextResponse } from "next/server";
import { extractCookieValue, getSetCookieValues, withCookie } from "./lib/auth/cookie-utils";

const ACCESS_COOKIE = "orelia_access_token";
const REFRESH_COOKIE = "orelia_refresh_token";
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
// Refresh a little before actual expiry so an in-flight page render never
// races a token that dies mid-request.
const REFRESH_BUFFER_MS = 30_000;

function decodeJwtExpiryMs(token: string): number | null {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return null;
  try {
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.next();
  }

  const expiresAt = accessToken ? decodeJwtExpiryMs(accessToken) : null;
  const needsRefresh = !accessToken || expiresAt === null || Date.now() >= expiresAt - REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return NextResponse.next();
  }

  let refreshRes: Response;
  try {
    refreshRes = await fetch(`${API_INTERNAL_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
    });
  } catch {
    // Backend unreachable — let the request proceed with whatever token it
    // has; the page's own auth check will redirect to login if it's dead.
    return NextResponse.next();
  }

  if (!refreshRes.ok) {
    // Refresh token itself is dead/expired/revoked — nothing to recover,
    // let the normal "no valid session" path handle it.
    return NextResponse.next();
  }

  const setCookieValues = getSetCookieValues(refreshRes.headers);

  if (setCookieValues.length === 0) {
    return NextResponse.next();
  }

  // Rewrite this same request's Cookie header so the Server Component render
  // that follows sees the fresh access token immediately, instead of failing
  // once more before the browser gets the new cookie on the *next* request.
  const newAccessToken = extractCookieValue(setCookieValues, ACCESS_COOKIE);
  const requestHeaders = new Headers(request.headers);
  if (newAccessToken) {
    requestHeaders.set("cookie", withCookie(requestHeaders.get("cookie") ?? "", ACCESS_COOKIE, newAccessToken));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of setCookieValues) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
