# Cross-Tab Session Sync — Refresh Race + Identity Switch Fix

**Author:** Winston (System Architect)
**Status:** Draft — awaiting sign-off before Fix A implementation begins
**Context:** Follow-on from `f3c2cc4` (expired-session logout 401 fix). While reviewing the full
15-minute access-token / 7-day refresh-token lifecycle, two related but distinct multi-tab bugs
were identified. Neither is fixed yet — this document is the plan, not a changelog.

---

## 1. Background — how the current session system works

- Access JWT: 15 min (`JWT_ACCESS_EXPIRES_IN`), signed, `ignoreExpiration: false`
  (`backend/src/modules/auth/strategies/jwt.strategy.ts`).
- Refresh token: 7 days, random 48-byte hex (not a JWT), hashed at rest in `refresh_tokens`,
  **rotated on every use** — the old row is revoked the instant a new pair is issued
  (`backend/src/modules/auth/auth.service.ts:120-155`, `refresh()`).
- Both tokens live in httpOnly cookies, shared across every tab in the browser profile (cookies
  are per-origin, not per-tab).
- Three layers keep sessions alive without user action: `middleware.ts` (proactive, refreshes 30s
  before the JWT's own `exp`), `server-client.ts` (reactive, Server Component 401 → refresh →
  retry, deduped via React `cache()`), `client.ts` (reactive, browser fetch 401 → refresh →
  retry, deduped via an in-tab `refreshPromise`).

## 2. The two bugs

### 2a. Refresh-token race across concurrent callers

Because the refresh token is single-use and revoked immediately on rotation, two callers
presenting the *same* refresh-token cookie at nearly the same moment — two open tabs, or
`middleware.ts` and `client.ts` firing close together — will have one succeed and one hard-401.
The loser is a live session; it just lost a coin flip. The `refreshPromise` dedupe in `client.ts`
only protects against duplicate calls **within one tab's JS memory** — it does nothing across
tabs, and nothing for `middleware.ts`, which runs server-side per request with no shared browser
state at all.

### 2b. Silent identity switch across tabs

Cookies aren't tab-scoped, so logging in as a different user in a new tab doesn't create a second
session — it **overwrites the only session that exists**. An already-open tab has no way to know
this happened until its next request, at which point it silently starts acting as the new user
(UI still shows the old user until the next full render). For a CRM tracking `createdBy`/
`updatedBy` on every row, this is a data-integrity risk, not just a UX rough edge. Today there is
no cross-tab signal at all — confirmed via grep, no `BroadcastChannel`/`storage` event usage
exists in `frontend/src`.

## 3. Fix A — refresh-token reuse grace window (backend, root cause of 2a)

**Design:** the two racing responses can arrive at the browser in either order — that's a network
timing race, not something request ordering on the backend can prevent. The only way to make the
outcome safe regardless of arrival order is for **both responses to carry the identical new
refresh token**, so it doesn't matter which one's `Set-Cookie` header the browser keeps.

- Add two columns to `refresh_tokens`
  (`backend/src/modules/users/entities/refresh-token.entity.ts`):
  - `graceToken` (nullable string) — the new raw refresh token, written onto the **old** row at
    the moment it's rotated out.
  - `graceExpiresAt` (nullable timestamptz) — `rotatedAt + 10s`.
- In `AuthService.refresh()` (`auth.service.ts:120-155`): if the presented token hashes to a row
  that's already `revokedAt` **and** `now < graceExpiresAt`, do not 401 — return the cached
  `graceToken` verbatim (plus a freshly-signed access JWT; access tokens are stateless, so
  re-signing on every grace-window replay is safe and doesn't touch the rotation/revocation
  tracking at all).
- Reused-outside-the-window (i.e. after 10s) still 401s exactly as today — this fix narrows the
  race window, it does not weaken revocation.
- Covers **every** caller uniformly (two tabs, `middleware.ts`, `server-client.ts`, `client.ts`)
  with one backend change — no frontend coordination primitive (Web Locks, cross-tab mutex)
  needed, which was considered and rejected as unnecessary complexity once the backend replay
  fix is in place.

**Explicit tradeoff for sign-off:** this means a valid refresh token sits in the database in
**plaintext** (not hashed) for up to 10 seconds after rotation — every other secret in this
system is hashed at rest; this is a deliberate, tightly-scoped exception. Risk is bounded: 10
seconds, only the just-rotated-out row, self-expiring. Flagged here because this project holds a
real audit/security bar (see CLAUDE.md) and this is the one place this plan deviates from it.

**Files:**
- `backend/src/modules/users/entities/refresh-token.entity.ts` — add `graceToken`,
  `graceExpiresAt` columns.
- New TypeORM migration for the above.
- `backend/src/modules/auth/auth.service.ts` — `refresh()` method: grace-window check before the
  existing revoked/expired rejection; write `graceToken`/`graceExpiresAt` onto the old row instead
  of only setting `revokedAt`.

## 4. Fix B — cross-tab identity broadcast (frontend, fixes 2b)

**Design:** treat the shared cookie jar as the single source of truth, and use a same-origin
broadcast so every open tab reacts the moment it changes. Confirmed behavior (user sign-off):
**silent reload** — no warning toast, matches the Slack/GitHub pattern of just reloading into
whatever the cookies now say, since a reload re-hits `/auth/me` and re-renders correctly either
way (new user, or bounced to login if logged out).

- New module `frontend/src/lib/auth/tab-sync.ts`: wraps a `BroadcastChannel("orelia-auth")`
  (feature-detected, no-op if unsupported), exposing `announceAuthChange()` and a
  subscribe-and-reload listener.
- `frontend/src/lib/api/auth.ts` — `login()` and `logout()` call `announceAuthChange()` on
  success.
- Every other open tab, on receiving the broadcast, does `window.location.reload()`.

**Files:**
- `frontend/src/lib/auth/tab-sync.ts` (new).
- `frontend/src/lib/api/auth.ts` — wire broadcast into `login`/`logout`.
- Wherever the listener gets mounted once globally (likely the dashboard layout or a top-level
  client component — to be confirmed at implementation time).

## 5. Explicitly out of scope for this pass

- **Reuse-detection / theft response** — the security counterpart to Fix A's grace window: a
  rotated-out token reused *after* the grace window is currently just a normal 401, same as
  today. Production systems often treat late reuse as a compromise signal and revoke the entire
  token family. Deferred by user decision — separate future item, not blocked by anything in this
  plan.
- **True multi-account support** (independent sessions per tab, à la Google's account switcher) —
  a much larger feature (per-account cookie namespacing, account-chooser UI). Not what was asked
  for; noted only so "silent reload" isn't mistaken for multi-account support later.

## 6. Execution order

One phase at a time, verified before the next (per standing project convention):

1. **Fix A** — backend grace-window + migration. Verify: reproduce the race (two near-simultaneous
   `POST /auth/refresh` calls with the same token) and confirm both succeed with identical tokens;
   confirm reuse past 10s still 401s; confirm normal single-caller refresh is unaffected.
2. **Fix B** — frontend broadcast + reload. Verify: two tabs open, log in as a different user in
   one, confirm the other reloads and reflects the new session; log out in one, confirm the other
   reloads to login.

Sign-off required after each phase before starting the next.
