import { cookies } from "next/headers";

// Server-only fetch helper — runs inside the Next.js server process (Server
// Components), which must reach the backend via the internal Docker service
// hostname rather than NEXT_PUBLIC_API_URL (that one is for browser fetches).
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

function getCookieHeader(): string {
  return cookies()
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${API_INTERNAL_URL}/api${path}`, {
    ...init,
    headers: {
      cookie: getCookieHeader(),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<T>;
}
