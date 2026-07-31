import { MailDeliveryResult } from "@orelia/common";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sgMail from "@sendgrid/mail";

export interface WelcomeEmailInput {
  to: string;
  displayName: string;
  username: string;
  temporaryPassword: string;
  tenantSlug: string;
}

// Single transactional-email integration boundary for the whole app (mirrors
// S3Service's role for file storage) -- registered globally via CoreModule so
// any service can call it with zero extra module wiring. Currently only
// sends the "your account was created" welcome email (Users create flow);
// add new send*Email methods here as more triggers come up, same as
// S3Service growing new put/get methods rather than spawning new services.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private sdkInitialized = false;
  private readonly apiKey?: string;
  private readonly fromAddress?: string;
  private readonly fromName: string;
  private readonly appBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("SENDGRID_API_KEY");
    this.fromAddress = this.config.get<string>("MAIL_FROM_ADDRESS");
    this.fromName = this.config.get<string>("MAIL_FROM_NAME") ?? "NEXUS CRM";
    this.appBaseUrl = this.config.get<string>("APP_BASE_URL") ?? "http://localhost:3000";
  }

  isEnabled(): boolean {
    return !!this.apiKey && !!this.fromAddress;
  }

  private ensureSdkInitialized(): void {
    if (this.sdkInitialized) return;
    sgMail.setApiKey(this.apiKey as string);
    this.sdkInitialized = true;
  }

  // Best-effort, same posture as AuditLogService.record() and S3Service's
  // deleteObjectBestEffort() -- a failed or skipped send must never fail the
  // real user-creation request that triggered it, so this never throws.
  //
  // It does, however, RETURN the outcome. Never throwing and returning void
  // are two different things, and conflating them was a real bug: the caller
  // had no way to distinguish "emailed" from "silently dropped", so the admin
  // got an unqualified success for an account whose one and only copy of the
  // temporary password went nowhere. Callers must surface a false `sent`.
  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<MailDeliveryResult> {
    this.logger.debug(`sendWelcomeEmail called for ${input.to} (user "${input.username}")`);
    if (!this.isEnabled()) {
      this.logger.warn("sendWelcomeEmail skipped: SENDGRID_API_KEY/MAIL_FROM_ADDRESS not configured");
      return { sent: false, reason: "not_configured" };
    }
    try {
      this.ensureSdkInitialized();
      const loginUrl = `${this.appBaseUrl}/${input.tenantSlug}`;
      await sgMail.send({
        to: input.to,
        from: { email: this.fromAddress as string, name: this.fromName },
        subject: "Your Nexus CRM account has been created",
        text: buildWelcomeText(input, loginUrl),
        html: buildWelcomeHtml(input, loginUrl),
      });
      this.logger.debug(`sendWelcomeEmail succeeded for ${input.to}`);
      return { sent: true };
    } catch (err) {
      // SendGrid puts the actionable detail (unverified sender, bad key,
      // invalid recipient) in response.body.errors, not in `message` -- which
      // is just "Forbidden"/"Bad Request". Log both, or diagnosing a failed
      // send from the terminal is guesswork.
      const detail = (err as { response?: { body?: unknown } }).response?.body;
      this.logger.error(
        `sendWelcomeEmail failed for ${input.to}: ${(err as Error).message}` +
          (detail ? ` -- provider said: ${JSON.stringify(detail)}` : ""),
        (err as Error).stack,
      );
      return { sent: false, reason: "send_failed" };
    }
  }
}

function buildWelcomeText(input: WelcomeEmailInput, loginUrl: string): string {
  return [
    `Hi ${input.displayName},`,
    "",
    "Welcome to Nexus CRM! An account has been created for you -- here's what you need to sign in:",
    "",
    `  Username:            ${input.username}`,
    `  Temporary password:  ${input.temporaryPassword}`,
    "",
    `Log in here: ${loginUrl}`,
    "",
    "You'll be asked to set a new password the first time you sign in.",
    "If you weren't expecting this email, you can ignore it or contact your administrator.",
  ].join("\n");
}

// Brand colors are hardcoded here (not var(--color-crm-primary) etc.)
// deliberately -- this is raw HTML handed to SendGrid, rendered by mail
// clients with no guaranteed CSS custom property support, unlike every
// frontend component. Layout uses nested <table role="presentation">
// elements with inline styles rather than divs/flexbox -- the standard
// technique for HTML email, since client CSS support (Outlook especially)
// is far less consistent than a browser's.
function buildWelcomeHtml(input: WelcomeEmailInput, loginUrl: string): string {
  const name = escapeHtml(input.displayName);
  const username = escapeHtml(input.username);
  const password = escapeHtml(input.temporaryPassword);

  return `
    <div style="background: #F8FAFC; padding: 32px 16px; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto;">
        <tr>
          <td style="background: #022B5D; border-radius: 10px 10px 0 0; padding: 22px 32px; text-align: center;">
            <span style="font-size: 19px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">NEXUS CRM</span>
          </td>
        </tr>
        <tr>
          <td style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; padding: 32px;">
            <h1 style="margin: 0 0 8px; font-size: 20px; color: #0F172A;">Welcome, ${name}</h1>
            <p style="margin: 0 0 24px; font-size: 14px; color: #334155; line-height: 1.5;">
              An account has been created for you on Nexus CRM. Use the credentials below to sign in.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
              <tr>
                <td style="padding: 14px 18px; font-size: 12px; color: #64748b;">Username</td>
                <td style="padding: 14px 18px; font-size: 14px; color: #0F172A; font-weight: bold; text-align: right;">${username}</td>
              </tr>
              <tr>
                <td colspan="2" style="border-top: 1px solid #e2e8f0; line-height: 1px; font-size: 1px;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding: 14px 18px; font-size: 12px; color: #64748b;">Temporary password</td>
                <td style="padding: 14px 18px; font-size: 14px; color: #0F172A; font-weight: bold; text-align: right; font-family: 'Courier New', monospace;">${password}</td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
              <tr>
                <td style="border-radius: 8px; background: #ED1B24;">
                  <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none;">
                    Log in to Nexus CRM
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin: 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
              You'll be asked to set a new password the first time you sign in. If you weren't
              expecting this email, you can safely ignore it or contact your administrator.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 8px; text-align: center; font-size: 11.5px; color: #94a3b8;">
            This is an automated message from Nexus CRM &mdash; please don't reply.
          </td>
        </tr>
      </table>
    </div>
  `;
}

function escapeHtml(value: string): string {
  const escapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (c) => escapes[c] as string);
}
