# Bugs — User Provisioning & Credential Lifecycle

Findings from an architecture review of the just-merged credential work (commits `8b5406e`,
`35c81d1`, `6b259a8`, `ad82aed`), conducted **2026-07-31** against the code merged into `dev-g` at
`2ff3d34`. Same `source` / `summary` / `evidence` / `resolved` shape as
`deferred-work.md`, with `[HIGH]` / `[MEDIUM]` / `[LOW]` severity.

Unlike `deferred-work.md`, **these are not deferred** — this is an active fix list, worked one at a
time. Each entry gets a `resolved:` line the moment its fix is verified. Stories that implement
these live in `_bmad-output/planning-artifacts/epics-user-management.md`.

**Status: 0 of 11 fixed.**

---

## Fix order

| # | Bug | Severity | Story | Status |
|---|---|---|---|---|
| 1 | Welcome-email failure is invisible to the admin | HIGH | 1.4 | open |
| 2 | `APP_BASE_URL` unset → welcome email links to `localhost:3000` | HIGH | 1.4 | open |
| 3 | User creation is not atomic — a failed employee link orphans the account | HIGH | — | open |
| 4 | Admin password reset does not revoke existing sessions | HIGH | 1.5 | open |
| 5 | Temporary passwords never expire | HIGH | 1.1 | open |
| 6 | No resend path; the only recovery leaks the credential out-of-band | HIGH | 1.2 / 1.3 | open |
| 7 | Login email can be changed with no verification or notification | HIGH (latent) | 1.7 | open |
| 8 | `UserStatus.Invited` is modelled but never set | MEDIUM | 1.6 | open |
| 9 | No self-service "Forgot password" | MEDIUM | 1.8 | open |
| 10 | New user-facing strings are hardcoded, against the i18n rule | LOW | — | open |
| 11 | `ResetPasswordRequest` still carries an admin-supplied password | LOW | 1.3 | open |

---

- source: architecture review of commits `8b5406e`/`35c81d1`/`6b259a8`, 2026-07-31
  id: 1
  summary: "[HIGH] A failed or skipped welcome email is completely invisible to the administrator — the account is created, reported as a success, and is unusable by anyone."
  evidence: "`mail.service.ts` `sendWelcomeEmail()` returns early with only a `logger.warn` when `SENDGRID_API_KEY`/`MAIL_FROM_ADDRESS` are unset (L51-54), and its `catch` swallows every provider error with `logger.error` and no rethrow (L66-68). Both behaviours are correct in isolation — a failed send must never fail the committed account creation, matching `AuditLogService.record()`'s documented posture — but nothing propagates the outcome. `UsersService.create()` awaits the call and ignores its `void` return; `UsersController.create()` returns a `UserResponse` with no delivery field; `UserFormDialog.handleSubmit` closes on success with no warning. Because the temp password is surfaced *only* in that email (`users.service.ts` L165-171 says so explicitly), a silent failure produces an account whose password is known to nobody and which no one can log into. Mail credentials were unset in this project's `.env` until 2026-07-31, so every account created before then is in exactly this state."

- source: architecture review, 2026-07-31
  id: 2
  summary: "[HIGH] `APP_BASE_URL` is not set in `.env`, so the welcome email's login button points at `http://localhost:3000` — a dead link for every real recipient."
  evidence: "`mail.service.ts` L33 falls back to `http://localhost:3000` when the variable is absent, and `env.validation.ts` gives it the same default rather than requiring it, so the app boots clean and nothing flags the omission. `sendWelcomeEmail()` builds `loginUrl = \`${this.appBaseUrl}/${input.tenantSlug}\`` (L57), used for both the text body and the HTML call-to-action button (L132). Now that `SENDGRID_API_KEY` and `MAIL_FROM_ADDRESS` are configured (2026-07-31), mail actually sends — which turns this from dormant to live: recipients get a correctly-branded email whose only action button resolves to their own machine. Related: `MAIL_FROM_ADDRESS=crm@orelit.com` must also be a verified sender/domain in SendGrid or every send fails with a 403 that, per bug 1, nobody sees."

- source: architecture review, 2026-07-31
  id: 3
  summary: "[HIGH] User creation is not transactional — a `ConflictException` from the employee link leaves a committed, un-emailed, un-loggable-into account behind, and retrying then fails with a username conflict."
  evidence: "`users.service.ts` `create()` performs five sequential operations with no transaction: `saveScoped(user)` (L142, commits immediately), `auditLogService.record()`, `rbacService.assignRolesToUser()`, `employeesService.linkToUser()` (L162), and finally `mailService.sendWelcomeEmail()` (L179). `linkToUser()` throws `ConflictException(\"This employee is already linked to another user account\")` (`employees.service.ts` L541) whenever the chosen employee is already claimed — a routine, user-triggerable input error, not an exceptional condition. When it fires, `create()`'s catch rethrows, the admin sees a 409, and the dialog stays open — but the user row is already persisted with a temporary password, and because the mail call sits *after* the link, no email was ever sent. Correcting the employee selection and resubmitting now hits `assertUsernameAvailable`'s 409 instead, because the username is genuinely taken — by the orphan the previous attempt created. The admin is stuck with an invisible, unusable account and no UI path to recover it. Same applies to any throw from `assignRolesToUser()`."

- source: architecture review, 2026-07-31
  id: 4
  summary: "[HIGH] An administrator resetting a user's password does not revoke that user's existing sessions, so resetting a compromised account leaves the attacker logged in."
  evidence: "`users.service.ts` `resetPassword()` (L277-301) writes the new hash, sets `mustChangePassword`, records an audit row, and returns — it never touches `refreshTokenRepo`. Both sibling methods do, and their comments show the risk is understood: `changeOwnPassword()` (L336-339) revokes all other sessions because 'old refresh tokens were minted under the password that just changed', and `disable()` (L363) revokes all of them noting 'Status alone only blocks future logins — refresh() doesn't currently check status, so an already-issued refresh token would keep silently minting new access tokens.' That reasoning applies identically here and was not carried across. Resetting a password is the standard first response to a suspected account compromise; today it rotates the credential while leaving the attacker's refresh token fully functional until it expires on its own."

- source: architecture review, 2026-07-31
  id: 5
  summary: "[HIGH] The system-generated temporary password never expires — it remains a valid credential indefinitely."
  evidence: "There is no TTL anywhere in the flow. `users.service.ts` `create()` hashes the generated password into `users.password_hash` and sets `mustChangePassword: true`; the `User` entity (`user.entity.ts`) has no expiry column, and `AuthService.login()` (L54-102) checks tenant, `status`, `lockedUntil`, and the bcrypt comparison — nothing time-bounds the credential itself. `mustChangePassword` limits what the password can do *after* it is used, but places no bound on *how long it stays usable*. The credential is delivered over email, an untrusted channel that retains the message indefinitely, so a mailbox compromised months later still yields a working login for any account whose invitation was never consumed."

- source: architecture review, 2026-07-31
  id: 6
  summary: "[HIGH] There is no way to resend an invitation, and the only recovery path forces the administrator to choose the password themselves — reintroducing the out-of-band credential handoff the auto-generation design exists to eliminate."
  evidence: "No resend endpoint exists in `users.controller.ts` and no resend action exists in `UsersTableWidget.tsx`. The sole recovery path is `ResetPasswordDialog.tsx`, which collects `password` + `confirmPassword` from the admin (L63-77) and POSTs them to `/users/:id/reset-password`. That is the pre-`6b259a8` design, left in place beside the new one it contradicts: `CreateUserDto` deliberately omits a password field and `users.service.ts` L124-127 states 'The server generates the initial password, not the admin... nobody but the new user ever sees it.' The reset path breaks that invariant — the admin now knows the user's password and must deliver it by WhatsApp, phone, or chat, which is precisely the leak the create flow was built to avoid. It is also the *only* remedy for bugs 1, 2, 3 and 5, so its weakness compounds all of them."

- source: architecture review, 2026-07-31
  id: 7
  summary: "[HIGH — latent; becomes exploitable the moment resend (bug 6) ships] A user's login email can be changed to any address with no verification and no notification to the previous address."
  evidence: "`UpdateUserDto` accepts `loggingEmail` with only `@IsEmail()` format validation, and `UsersService.update()` `Object.assign`s it straight onto the entity. Nothing verifies the new address exists or belongs to the account holder, and nothing notifies the old address that it was replaced. Today the exposure is limited, because no feature mails a credential to a user's stored address on demand. Once a resend action exists, any holder of `USERS_UPDATE` can repoint a higher-privileged account's `loggingEmail` at a mailbox they control, trigger a resend, and receive a working temporary password — a full account takeover executed entirely through intended features, with the only trace being a generic field-diff in `audit_logs`. This is why it must ship with, not after, the resend work."

- source: architecture review, 2026-07-31
  id: 8
  summary: "[MEDIUM] `UserStatus.Invited` is fully modelled and styled but never assigned, so an account whose invitation was never accepted is indistinguishable from an active one."
  evidence: "`UserStatus.Invited` exists in the enum and `UserStatusBadge` already renders it (it was given the amber 'pending' pairing during the Phase 3 status-badge colour fix). Nothing sets it: `users.service.ts` `create()` uses `status: dto.status ?? UserStatus.Active` (L137). The administrator therefore cannot tell who has completed onboarding from the Users list, and stale never-accepted invitations accumulate silently. Note the coupling that makes this non-trivial: `AuthService.login()` admits only `status === UserStatus.Active` (L65), so setting `Invited` at creation without also admitting it at login would lock every new user out of the forced-password-change flow that is supposed to activate them."

- source: architecture review, 2026-07-31
  id: 9
  summary: "[MEDIUM] There is no self-service password reset, so every forgotten password is an administrator ticket."
  evidence: "No forgot-password route, endpoint, or link exists — confirmed by search across `frontend/src` and `backend/src/modules/auth`. Combined with `AuthService`'s lockout (`LOGIN_LOCKOUT_THRESHOLD = 5`, `LOGIN_LOCKOUT_DURATION_MS = 15 min`, L30-31), a user who mistypes their password five times is locked out for 15 minutes with no way to help themselves. Deliberately sequenced last in the epic: it is the only item here that introduces an unauthenticated, publicly-reachable endpoint, and so needs enumeration-resistance and IP-level rate limiting that nothing else in this list requires."

- source: architecture review, 2026-07-31
  id: 10
  summary: "[LOW] User-facing strings added by the credential work are hardcoded in JSX and in the mail templates, against CLAUDE.md's i18n rule."
  evidence: "`UserFormDialog.tsx` L282-285 ('A temporary password will be generated automatically and emailed to this user...'), L290 ('Status *'), L312 ('Require password change on next login'), and the Add/Edit User dialog title; `ForcedPasswordChangeGate.tsx` L39-43 ('Set a new password', 'Hi {displayName} — for security, you need to set your own password before continuing.'); `ResetPasswordDialog.tsx` L55-58 and its field labels. CLAUDE.md's Internationalization section requires every user-facing string to be a `t()` lookup into `en.json`, and the same `UserFormDialog` already does this correctly for the linked-employee block (`t(\"users.form.linkedEmployee.label\")`), so the file is internally inconsistent. `mail.service.ts`'s subject and both body builders are also English-only, which is a larger question — the recipient's language preference is not knowable at send time from anything currently stored."

- source: architecture review, 2026-07-31
  id: 11
  summary: "[LOW] `ResetPasswordRequest`/`ResetPasswordDto` still accept an admin-supplied plaintext password, which will remain a bypass of the generate-and-email design unless removed rather than merely unused."
  evidence: "`reset-password.dto.ts` and the shared `ResetPasswordRequest` contract carry a `password` field, consumed by `UsersService.resetPassword(id, newPassword, updatedBy)`. When bug 6 is fixed by converting the reset path to generate-and-email, leaving this field accepted server-side would preserve an API-level path for a caller to set a chosen password for another user — the exact capability being designed out. Must be deleted from the DTO, the contract, and `frontend/src/lib/api/users.ts`, not just dropped from the dialog."
