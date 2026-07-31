---
stepsCompleted: ['1', '2']
inputDocuments: ['CLAUDE.md', 'backend/src/modules/users/', 'backend/src/core/mail/mail.service.ts', 'backend/src/modules/auth/auth.service.ts', 'frontend/src/components/layout/UserFormDialog.tsx', 'frontend/src/components/layout/ResetPasswordDialog.tsx', 'frontend/src/app/[tenant]/(dashboard)/_components/ForcedPasswordChangeGate.tsx']
---

# Nexus CRM — User Management Epic Breakdown

## Overview

User stories for **account provisioning and credential lifecycle** — how a user account comes into
existence, how its first credential reaches the human it belongs to, what happens when that
credential is never used or goes stale, and how an administrator recovers the situation without
ever learning the user's password.

This epic was opened on **2026-07-31** after a review of the just-merged credential work
(commits `8b5406e` "send a welcome email with credentials when a user is created", `35c81d1`
"redesign welcome email as a proper branded template", `6b259a8` "enforce forced password change +
auto-generate temp passwords", `ad82aed` "username reuse after soft-delete no longer 500s"). That
review confirmed the *generation and delivery* half is built and correct, and that the *expiry and
recovery* half does not exist at all. Stories 1.1–1.3 close that gap; 1.4–1.8 cover the practical
and security gaps found alongside it.

### Design principle for this epic

**The administrator must never know a user's password — not at creation, not at reset, not ever.**
Commit `6b259a8` established this for the create path (`CreateUserDto` deliberately has no password
field; `UsersService.create()` generates one itself and it is surfaced only in the email). Every
story below is measured against that principle, and Story 1.3 exists because the *reset* path still
violates it.

## Epic List

1. User Management — Account Provisioning & Credential Lifecycle

## Epic 1: User Management — Account Provisioning & Credential Lifecycle

### Current state (verified against code, 2026-07-31)

| Behaviour | Status |
|---|---|
| Admin does not supply a password when creating a user | ✅ Built — `CreateUserDto` has no password field |
| Server generates a 12-char crypto-random temp password | ✅ Built — `generateTemporaryPassword()`, `crypto.randomInt`, 4 character classes, Fisher-Yates shuffle |
| Temp password emailed to the user, branded template | ✅ Built — `MailService.sendWelcomeEmail()` |
| User forced to set their own password on first sign-in | ✅ Built — `mustChangePassword: true` unconditionally + `ForcedPasswordChangeGate` |
| Temp password is never written to logs | ✅ Built — explicit comments + `RequestLoggerMiddleware` redaction |
| **Temp password expires after a period** | ❌ **Does not exist.** No TTL column, no login check. The generated password is a permanent `bcrypt` hash in `users.password_hash` and works forever |
| **Admin can resend the welcome email** | ❌ **Does not exist.** No endpoint, no button |
| Admin can recover a stuck account | ⚠️ Only via `ResetPasswordDialog`, where the **admin types the password themselves** — contradicting the design principle above |
| Admin can see whether the welcome email was actually delivered | ❌ **Does not exist.** `sendWelcomeEmail()` is best-effort and never throws; a skipped or bounced send is invisible to the admin |
| Admin password reset ends the user's existing sessions | ❌ **Does not exist** — see Story 1.5, a live security gap |

---

### Story 1.1: Temporary Passwords Expire

As an **administrator provisioning accounts**,
I want **the system-generated temporary password to stop working after a configurable period**,
So that **a credential sitting unread in an inbox — or forwarded, or in a mailbox that is later
compromised — cannot be used to take over the account weeks or months after it was issued**.

**Context:** the temp password is delivered over email, which is an untrusted channel that retains
the message indefinitely. Forcing a password change on first login (already built) limits what the
credential can do *after* it is used, but does nothing to limit *how long it remains usable*. This
story adds that bound.

**Acceptance Criteria:**

**Given** a new user account is created
**When** the temporary password is generated
**Then** an expiry timestamp is stored alongside it on the `users` row (new nullable
`password_expires_at timestamptz` column, set to now + the configured TTL), and the value is
recorded in the account's `audit_logs` entry as a timestamp only — never the password itself

**Given** the TTL must suit both a security-strict and a practically-usable posture
**When** the value is configured
**Then** it comes from a single environment variable (`TEMP_PASSWORD_TTL_MINUTES`) validated in
`env.validation.ts` with a documented default, so changing it is a config edit and never a code
change — see the *TTL trade-off* note below for the recommended default

**Given** a user attempts to log in with a temporary password whose `password_expires_at` has passed
**When** `AuthService.login()` runs
**Then** the login is rejected with a message that distinguishes expiry from a wrong password
("Your temporary password has expired — ask your administrator to send a new one"), the failed
attempt does **not** count toward `loggingAttempts`/lockout (the credential was correct; the user
should not be locked out for the system's own time limit), and the outcome is logged at debug level
per CLAUDE.md's deep-logging rule

**Given** a user sets their own password through `ForcedPasswordChangeGate`
**When** `changeOwnPassword()` succeeds
**Then** `password_expires_at` is cleared to `NULL` — a real user-chosen password never expires by
this mechanism, and `NULL` is the unambiguous marker for "this is not a temporary credential"

**Given** existing accounts predate this column
**When** the migration runs
**Then** every existing row gets `password_expires_at = NULL` (never expires), so no already-working
account is broken by the deployment — expiry applies only to credentials issued from this point on

**Given** the expiry check must not be bypassable
**When** the code is reviewed
**Then** the check lives in `AuthService.login()` (server-side, alongside the existing `status` and
`lockedUntil` checks) and not in any frontend guard

---

**TTL trade-off — recommended default: 48 hours, not "a few minutes".**

The request that opened this epic specified "a few minutes." That is the right instinct for a
credential shown on screen, but the wrong bound for one delivered by email, for reasons that are
operational rather than architectural:

- SendGrid queueing plus recipient-side greylisting routinely adds **1–5 minutes** before the
  message is even visible. A 5-minute TTL can expire before the email arrives.
- New users are typically provisioned in a batch *before* onboarding day, not while the person is
  sitting at their desk waiting.
- If effectively every new user needs a resend, the resend flow (Story 1.2) becomes the primary
  path rather than the exception, and administrators learn to route around the security control.

The security value of expiry is almost entirely captured by "hours-to-days instead of forever." The
marginal gain from 48 hours to 5 minutes is small; the marginal operational cost is large. **48
hours** is the industry norm for emailed invitations and is the recommended default.

Because the TTL is a single config value, this remains the product owner's call and not a
one-way door — set `TEMP_PASSWORD_TTL_MINUTES=10` if a stricter posture is wanted, with no code
change. Story 1.2 (resend) is the safety valve that makes any short TTL survivable, which is why it
must ship in the same release, not after.

---

### Story 1.2: Resend Welcome Email With a Fresh Temporary Password

As an **administrator**,
I want **a "Resend invitation" action on a user who has not yet set their own password**,
So that **an expired, lost, spam-filtered, or never-delivered temporary password is recoverable in
one click, without me ever learning what that password is**.

**Acceptance Criteria:**

**Given** an administrator holding `USERS_UPDATE` views a user in the Users list
**When** that user's `mustChangePassword` is `true` (they have never set their own password)
**Then** a "Resend invitation" action is available on that row; for a user who has already set their
own password the action is hidden, because resending would silently invalidate a working password

**Given** the administrator triggers the resend
**When** `POST /users/:id/resend-invitation` runs
**Then** the server generates a **brand-new** temporary password (never re-sending the previous one,
which it cannot do — only the bcrypt hash is stored), replaces `password_hash`, sets a fresh
`password_expires_at`, keeps `mustChangePassword: true`, and emails it via the existing
`MailService.sendWelcomeEmail()` template

**Given** the previous temporary password may already be in someone's hands
**When** the resend completes
**Then** the previous temporary password no longer works — it was overwritten, not supplemented

**Given** the resend endpoint could be used to flood a user's inbox, or to probe which accounts exist
**When** the endpoint is called repeatedly
**Then** it is rate-limited per target user (a minimum interval between sends, e.g. 60 seconds,
returning `429` with a clear message), and it is gated on `USERS_UPDATE` — it is an RBAC route, not
a system-internal picker route, per CLAUDE.md's route-category rule

**Given** every credential-affecting action must be attributable
**When** a resend succeeds
**Then** an `audit_logs` row is written (`entityType: "user"`, `action: "update"`, actor = the
administrator, changes = `{ invitationResent: true, passwordExpiresAt }`) containing **no password
material**, matching the precedent set by `resetPassword()`'s `{ passwordReset: true }` entry

**Given** the send itself is best-effort and may silently fail
**When** the resend returns
**Then** the response tells the administrator whether the mail was actually handed to the provider
or skipped/failed — see Story 1.4, which this story depends on for a truthful confirmation message

**Given** CLAUDE.md's endpoint registry rule
**When** the endpoint is added
**Then** `_bmad-output/2-current-work/api-endpoint-registry.md` is updated in the same
change, and every new user-facing string goes through `t()` into `en.json`, not hardcoded JSX

---

### Story 1.3: Admin Password Reset Generates and Emails — Never Typed

As an **administrator resetting a password for a user who is locked out or compromised**,
I want **the system to generate and email the new temporary password**,
So that **I never learn a user's credential and never have to hand it over on WhatsApp or verbally —
which is where the current dialog forces me, and where credentials leak**.

**Context:** `ResetPasswordDialog` currently asks the administrator to type and confirm a password,
which is then sent to `POST /users/:id/reset-password`. This is the pre-`6b259a8` design and now
directly contradicts the create flow built beside it. It is the *only* recovery path that exists
today, which is why Story 1.2 must land before or with this one.

**Acceptance Criteria:**

**Given** an administrator opens the reset-password action
**When** the dialog renders
**Then** it contains no password fields at all — only a confirmation of what will happen ("A new
temporary password will be generated and emailed to `<user's login email>`") and a confirm button

**Given** the administrator confirms
**When** the reset runs
**Then** the server generates the password (same `generateTemporaryPassword()` used at creation),
sets `mustChangePassword: true` and a fresh `password_expires_at`, and emails it — converging the
reset path onto exactly the same mechanism as Story 1.2's resend

**Given** the old `ResetPasswordRequest` contract carried an admin-supplied `password`
**When** the change ships
**Then** the field is removed from the DTO, the contract, and the frontend API client — leaving a
path that still accepts an admin-chosen password would preserve the exact hole this story closes

---

### Story 1.4: Welcome Email Delivery Status Is Visible to the Administrator

As an **administrator**,
I want **to see whether the welcome email was actually sent**,
So that **I do not create an account, tell the new joiner "check your email", and discover days
later that mail was never configured and the account has been unusable the whole time**.

**Context — this is a live production-readiness blocker, not a theoretical one.**
`MailService.sendWelcomeEmail()` returns early with only a `logger.warn` when `SENDGRID_API_KEY` /
`MAIL_FROM_ADDRESS` are unset, and swallows every send error by design (correctly — a failed send
must not fail account creation). Both variables are currently **unset in this project's `.env`**.
The result today: creating a user generates a password that is emailed nowhere, known to nobody, and
unrecoverable except by an admin-typed reset. The user-creation dialog reports unqualified success.

**Acceptance Criteria:**

**Given** mail is not configured, or the provider rejects the send
**When** a user is created or an invitation resent
**Then** the API response carries an explicit delivery indicator (e.g. `welcomeEmailSent: boolean`
plus a reason when false), and the UI shows a clearly-styled warning — not a success toast —
telling the administrator the account exists but the credential was not delivered, and what to do
about it

**Given** the failure must remain non-fatal
**When** the send fails
**Then** account creation still succeeds and still commits, preserving the existing best-effort
posture — this story changes only *visibility*, never the transactional behaviour

**Given** an administrator later looks at a user who has never signed in
**When** they view the Users list
**Then** they can tell "invitation sent, awaiting first login" apart from "invitation never
delivered" without reading backend logs

**Given** the deployment environment must be correct before this feature is usable at all
**When** this story is picked up
**Then** `SENDGRID_API_KEY`, `MAIL_FROM_ADDRESS`, and a production-correct `APP_BASE_URL` are
configured and a real end-to-end send is verified against a live inbox — per CLAUDE.md's precedent
that a flow is confirmed by exercising it for real, not by reading the code

---

### Story 1.5: Admin Password Reset Revokes Existing Sessions — SECURITY

As a **security-conscious administrator**,
I want **resetting a user's password to immediately end every session that user has open**,
So that **resetting the password of a compromised account actually ejects the attacker, instead of
leaving their session alive**.

**Context — this is a confirmed gap in current code.** `UsersService.resetPassword()` writes the new
hash and returns; it never touches `refresh_tokens`. Both sibling methods do exactly this and prove
the pattern is understood: `changeOwnPassword()` revokes all *other* sessions, and `disable()`
revokes all sessions with the comment "Status alone only blocks future logins." An admin reset is
the standard response to a suspected compromise, and today it is the one credential operation that
leaves the attacker's refresh token minting fresh access tokens.

**Acceptance Criteria:**

**Given** an administrator resets a user's password (via Story 1.3's flow) or resends an invitation
(Story 1.2)
**When** the new password hash is written
**Then** **every** `refresh_tokens` row for that user is revoked in the same operation — all
sessions, with no "spare the current one" exception, since the actor is the administrator and not
the user whose sessions these are

**Given** the revocation and the password write must not diverge
**When** the code is reviewed
**Then** both happen inside the same service method, so no future caller can perform one without the
other

---

### Story 1.6: A Never-Signed-In Account Is Visibly "Invited"

As an **administrator**,
I want **accounts that have been created but never activated to be visibly distinct**,
So that **I can see at a glance who has not completed onboarding, and chase or clean up stale
invitations instead of them silently accumulating**.

**Context:** `UserStatus.Invited` already exists in the enum and already has badge styling in
`UserStatusBadge`, but nothing ever sets it — `UsersService.create()` defaults to
`UserStatus.Active`. The state is modelled and unused.

**Acceptance Criteria:**

**Given** a new user is created
**When** the account is saved
**Then** its status is `Invited`, not `Active`

**Given** an invited user completes their forced password change
**When** `changeOwnPassword()` clears `mustChangePassword`
**Then** the status transitions to `Active` in the same operation, with an `audit_logs` entry

**Given** `AuthService.login()` currently admits only `status === Active`
**When** an invited user signs in with their valid temporary password
**Then** they are allowed through to the forced-password-change gate — otherwise this story would
lock every new user out of the very flow that activates them. This is the load-bearing detail of the
story and must be covered by an explicit test

**Given** pickers must not offer accounts that cannot yet act
**When** `findPicker()` runs
**Then** `Invited` accounts remain excluded (it already filters to `Active` only), consistent with
CLAUDE.md's Selectable Scope rule

---

### Story 1.7: Changing a User's Login Email Requires Re-Verification — SECURITY

As a **security-conscious administrator**,
I want **a change to a user's login email to require verification before credentials are sent to
the new address**,
So that **the combination of "edit email" plus "resend invitation" cannot be used to redirect a
working account's credentials to an attacker-controlled mailbox**.

**Context:** `UpdateUserDto` accepts `loggingEmail` with only `@IsEmail()` format validation. Once
Story 1.2 ships, any holder of `USERS_UPDATE` can point an existing account's email at an address
they control and trigger a credential send to it — a complete account takeover of, for example, a
higher-privileged user, performed entirely through intended features. **This story is a hard
dependency of Story 1.2 and must not be deferred past it.**

**Acceptance Criteria:**

**Given** an administrator changes an existing user's `loggingEmail`
**When** the change is saved
**Then** a notification is sent to the **previous** address recording that the login email was
changed, by whom, and when — so a redirect cannot happen silently

**Given** the new address is not yet proven to exist
**When** an invitation or reset is triggered for that user
**Then** the behaviour follows an explicitly-chosen policy, decided as part of this story: either
credentials go only to a verified address, or the email change itself requires a confirmation step.
The decision is recorded here rather than left implicit in code

**Given** a user's own email is a credential-bearing field
**When** any change to it occurs
**Then** an `audit_logs` entry records the old and new values, which the existing generic field-diff
in `update()` already produces — this criterion is a verification, not new code

---

### Story 1.8: Self-Service Password Reset ("Forgot password")

As a **user who has forgotten my password**,
I want **to request a reset myself from the login screen**,
So that **I am not blocked until an administrator is available, and administrators are not the
bottleneck for the single most common support request in any system**.

**Context:** no self-service path exists. With lockout at 5 attempts / 15 minutes
(`LOGIN_LOCKOUT_THRESHOLD`, `LOGIN_LOCKOUT_DURATION_MS`), every forgotten password is an admin
ticket. Sequenced last deliberately: it is the only story here that introduces an **unauthenticated,
publicly-reachable** endpoint, and so carries materially more attack surface than everything above.

**Acceptance Criteria:**

**Given** a user requests a reset from the login page for a given tenant slug and username or email
**When** the request is submitted
**Then** the response is **identical** whether or not the account exists — no user enumeration
through response body, status code, or timing

**Given** a reset is requested for an account that does exist
**When** the email is sent
**Then** it carries a **single-use, hashed-at-rest, short-lived token** (a link — not a password),
which is invalidated on first use and on expiry, and which cannot be reused after the user sets a
new password

**Given** the endpoint is unauthenticated
**When** it is deployed
**Then** it is rate-limited by both source IP and target account, and every request is logged per
CLAUDE.md's deep-logging rule

**Given** a token-based flow is introduced here
**When** this story is designed
**Then** evaluate converging Stories 1.1–1.3 onto the same one-time-link mechanism — see
*Architectural direction* below

---

## Architectural direction: temporary password now, invitation link later

Two designs solve "the emailed credential must not live forever":

**A — Temporary password with a TTL column** (Stories 1.1–1.3). One nullable column, one check in
`login()`, one new endpoint. It is a small delta on the flow that has *already shipped*, reuses the
branded template and the forced-change gate as-is, and introduces **no new unauthenticated
endpoint**. Its weakness is inherent: a usable plaintext credential sits in a mailbox — which is
precisely what the TTL bounds.

**B — Single-use invitation link.** The email carries a signed one-time link instead of a password;
the user clicks it and sets their own password; no temporary credential ever exists. This is the
modern standard and strictly stronger. Its cost is a new publicly-reachable endpoint with its own
token table, rate limiting, and enumeration-resistance requirements — the same machinery Story 1.8
must build anyway.

**Recommendation: A now, B when Story 1.8 is picked up.** Design A delivers the requested behaviour
against code that already exists and adds no new attack surface, which is the right trade while the
mail path itself is still unverified in production (Story 1.4). When 1.8 forces the token
infrastructure into existence, the marginal cost of moving provisioning onto it collapses, and A's
`password_expires_at` column retires naturally. Per *Rule of Three*: build the token mechanism when
there is a second real caller for it, not in anticipation of one.

## Build order

| # | Story | Why here |
|---|---|---|
| 1 | 1.4 Delivery status visible | Everything below assumes mail actually works; today it does not. Configure and verify first |
| 2 | 1.1 Temp password expiry | The requested behaviour; the column it adds is a dependency of 1.2 and 1.3 |
| 3 | 1.2 Resend invitation | Must ship with 1.1 — expiry without recovery strands accounts |
| 4 | 1.7 Email-change re-verification | Hard dependency of 1.2; shipping resend without it opens a takeover path |
| 5 | 1.5 Revoke sessions on reset | Small, self-contained security fix; independent of the rest |
| 6 | 1.3 Reset generates + emails | Converges the last admin-types-a-password path onto the new mechanism |
| 7 | 1.6 Invited status | Quality-of-life; touches the login guard, so best done once the flows above are settled |
| 8 | 1.8 Self-service reset | Largest attack surface; also the trigger to reconsider Design B above |

Stories 1.1–1.3 are the direct answer to the request that opened this epic. Stories 1.4, 1.5 and
1.7 were surfaced by the same review and are not optional polish — 1.4 is a live blocker, 1.5 and
1.7 are security gaps.
