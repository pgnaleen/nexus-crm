# Epic 6: User Management — Account Provisioning & Credential Lifecycle (in-progress — 1/8)

Part of the split epics tracker — see [`../EPICS.md`](../EPICS.md) for the status-source note and
the "Unsorted / Current Focus" cross-cutting items shared across every file in this folder.

Closes the gap between "credential generation/delivery is built and correct" and "expiry/recovery
does not exist at all," found during a 2026-07-31 review of the just-merged credential work.
Design principle for every story: **the administrator must never know a user's password.** Full
findings evidence for all 11 underlying bugs: see
[`../bugs/user-provisioning.md`](../bugs/user-provisioning.md).

- [ ] 6.1 Temporary Passwords Expire — recommended default TTL 48h via
  `TEMP_PASSWORD_TTL_MINUTES`, not "a few minutes" (email delivery lag + batch-provisioning
  reasoning documented in the story). Depends on 6.2 shipping in the same release.
- [ ] 6.2 Resend Welcome Email With a Fresh Temporary Password
- [ ] 6.3 Admin Password Reset Generates and Emails — Never Typed (removes the admin-typed-password
  field from `ResetPasswordDialog`/`ResetPasswordRequest` entirely)
- [ ] 6.4 Welcome Email Delivery Status Visible to the Administrator (in progress/review) —
  implemented and verified live 2026-07-31 per `sprint-status.yaml` (`MailDeliveryResult` contract,
  `CreateUserResponse.welcomeEmail`, warning panel in `UserFormDialog`), but flagged **still
  uncommitted** as of that verification. **Given several unrelated features have shipped since
  (Deal Team rework, Activity Log, dashboard Stories 2.9/2.10 — all 2026-08-03/04), this status
  needs re-checking against current `git log` before being trusted** — it may already be committed
  and simply never updated in the tracking file.
- [ ] 6.5 Admin Password Reset Revokes Existing Sessions (SECURITY) — small, self-contained;
  `resetPassword()` needs the same `refresh_tokens` revocation `changeOwnPassword()`/`disable()`
  already do.
- [ ] 6.6 A Never-Signed-In Account Is Visibly "Invited" — `UserStatus.Invited` exists and is
  already styled but nothing ever sets it; must also admit `Invited` users through `login()`'s
  forced-password-change gate, not just at creation.
- [ ] 6.7 Changing a User's Login Email Requires Re-Verification (SECURITY) — hard dependency of
  6.2; shipping resend without this opens an account-takeover path via email-then-resend.
- [ ] 6.8 Self-Service Password Reset ("Forgot password") — sequenced last deliberately: the only
  unauthenticated, publicly-reachable endpoint in this epic. Recommended design: temp-password-TTL
  now (6.1–6.3), converge onto a single-use invitation-link mechanism once this story's token
  infrastructure exists (see the epic source file's "Architectural direction" section).

**Recommended build order** (from the epic source, not yet re-confirmed against current state):
6.4 → 6.1 → 6.2 → 6.7 → 6.5 → 6.3 → 6.6 → 6.8.
