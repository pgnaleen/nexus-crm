const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// A failed refresh means the session is definitively dead (refresh token
// itself expired/revoked, not just the access token) -- every apiFetch
// caller shares this, not just whichever one happened to notice, so an
// idle tab with a dead session gets kicked to login on its very next
// request instead of sitting silently broken until a manual page refresh.
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const tenantSlug = window.location.pathname.split("/")[1] ?? "";
  const loginPath = `/${tenantSlug}`;
  if (window.location.pathname === loginPath) return;
  window.location.href = loginPath;
}

// Concurrent 401s must share one refresh attempt — the refresh token is
// rotated on use, so a second call with the same (now-stale) token would
// fail and needlessly log the user out.
let refreshPromise: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const startedAt = Date.now();

  const doFetch = () =>
    fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

  try {
    let res = await doFetch();

    if (res.status === 401) {
      console.log(`[apiFetch] ${method} ${path} -> 401, attempting session refresh`);
      if (await refreshSession()) {
        console.log(`[apiFetch] ${method} ${path} -> refresh succeeded, retrying request`);
        res = await doFetch();
      } else {
        console.log(`[apiFetch] ${method} ${path} -> refresh failed, session is dead, redirecting to login`);
        redirectToLogin();
      }
    }

    const duration = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error(`[apiFetch] ${method} ${path} ${res.status} ${duration}ms: ${body?.message ?? "no message"}`);
      throw new ApiError(body?.message ?? `Request failed with status ${res.status}`, res.status);
    }

    console.log(`[apiFetch] ${method} ${path} ${res.status} ${duration}ms`);

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    const duration = Date.now() - startedAt;
    console.error(`[apiFetch] ${method} ${path} failed after ${duration}ms: ${(err as Error).message}`);
    throw err;
  }
}
