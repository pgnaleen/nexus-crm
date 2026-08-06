# User Provisioning & Credential Lifecycle (Epic 6)

Part of the split bugs tracker — see [`../BUGS.md`](../BUGS.md) for the severity legend shared
across every file in this folder.

All 11 findings from the 2026-07-31 architecture review of the credential work. Each has a story
number in [`../epics/epic-6-user-management.md`](../epics/epic-6-user-management.md) except #3
and #10.

| # | Bug | Sev | Story |
|---|---|:--:|---|
| 1 | A failed/skipped welcome email is invisible to the admin — account created, reported success, unusable by anyone. `mail.service.ts::sendWelcomeEmail()` swallows the failure by design (correctly — must not fail account creation) but nothing propagates the outcome. | 🟠 | 6.4 (in progress — see `../epics/epic-6-user-management.md`'s status note) |
| 2 | `APP_BASE_URL` unset → welcome email's login button points at `localhost:3000` for every real recipient. | 🟠 | 6.4 |
| 3 | `UsersService.create()` isn't transactional — a `ConflictException` from the employee-link step (already-claimed employee) leaves a committed, un-emailed, un-loggable-into account; retrying then 409s on the username. | 🟠 | none — should ship alongside Epic 6 |
| 4 | Admin password reset doesn't revoke the user's existing sessions — resetting a compromised account leaves the attacker logged in. Sibling methods (`changeOwnPassword()`, `disable()`) already do this. | 🟠 | 6.5 |
| 5 | Temporary passwords never expire — no TTL column, no login-time check. | 🟠 | 6.1 |
| 6 | No resend path; the only recovery (`ResetPasswordDialog`) makes the admin type and know the password themselves, contradicting the create flow's whole design. | 🟠 | 6.2 / 6.3 |
| 7 | Login email can be changed with no verification or notification to the old address — latent until resend (bug 6) ships, then becomes a full account-takeover path. | 🟠 (latent) | 6.7 |
| 8 | `UserStatus.Invited` is modelled and styled but never assigned — an account that never completed onboarding is indistinguishable from an active one. | 🟡 | 6.6 |
| 9 | No self-service "Forgot password" — every forgotten password is an admin ticket; 5-attempt/15-min lockout makes this worse. | 🟡 | 6.8 |
| 10 | New user-facing strings in the credential work are hardcoded, against the i18n rule (`UserFormDialog.tsx`, `ForcedPasswordChangeGate.tsx`, `ResetPasswordDialog.tsx`, mail templates). | ⚪ | none |
| 11 | `ResetPasswordRequest`/DTO still accepts an admin-supplied plaintext password — must be deleted, not just left unused, once 6.3 ships. | ⚪ | 6.3 |
