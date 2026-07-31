/**
 * Why a best-effort transactional email did not go out.
 *
 * - `not_configured` -- SENDGRID_API_KEY / MAIL_FROM_ADDRESS are unset, so the
 *   app is running without a mail provider at all. An operator problem, fixed
 *   in `.env`, not something the admin who triggered the send can resolve.
 * - `send_failed`    -- the provider was called and rejected or errored (bad
 *   API key, unverified sender, hard bounce, network failure).
 * - `no_tenant_context` -- the send needed the tenant slug to build the login
 *   link and no tenant context was established on the request.
 */
export type MailDeliveryFailureReason = "not_configured" | "send_failed" | "no_tenant_context";

/**
 * Outcome of a transactional email send.
 *
 * Exists because MailService is deliberately best-effort -- it never throws, so
 * that a failed send can't roll back the real operation that triggered it (same
 * posture as AuditLogService.record()). That's correct, but without a returned
 * result the caller has no way to tell success from silent failure, and the
 * admin gets an unqualified success message for an account whose credential was
 * never delivered. Every `send*Email` method returns this so the outcome can be
 * surfaced instead of swallowed.
 */
export interface MailDeliveryResult {
  /**
   * The provider ACCEPTED the message -- not that it reached the inbox.
   *
   * SendGrid's v3 API queues and validates recipients asynchronously, so a
   * non-existent recipient domain still returns success here and hard-bounces
   * later (verified 2026-07-31 by sending to an `.invalid` domain: HTTP 202,
   * `sent: true`). A `true` therefore rules out the failures we can see
   * synchronously -- unconfigured provider, bad API key, unverified sender --
   * and nothing more. Catching bounces needs SendGrid's Event Webhook, which
   * this app does not consume; until it does, "the user says they never got
   * it" stays a real possibility even on `sent: true`.
   */
  sent: boolean;
  /** Present only when `sent` is false. */
  reason?: MailDeliveryFailureReason;
}
