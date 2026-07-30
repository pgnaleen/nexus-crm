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
    this.fromName = this.config.get<string>("MAIL_FROM_NAME") ?? "ORELIA CRM";
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
  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
    this.logger.debug(`sendWelcomeEmail called for ${input.to} (user "${input.username}")`);
    if (!this.isEnabled()) {
      this.logger.warn("sendWelcomeEmail skipped: SENDGRID_API_KEY/MAIL_FROM_ADDRESS not configured");
      return;
    }
    try {
      this.ensureSdkInitialized();
      const loginUrl = `${this.appBaseUrl}/${input.tenantSlug}`;
      await sgMail.send({
        to: input.to,
        from: { email: this.fromAddress as string, name: this.fromName },
        subject: "Your ORELIA CRM account has been created",
        text: buildWelcomeText(input, loginUrl),
        html: buildWelcomeHtml(input, loginUrl),
      });
      this.logger.debug(`sendWelcomeEmail succeeded for ${input.to}`);
    } catch (err) {
      this.logger.error(`sendWelcomeEmail failed for ${input.to}: ${(err as Error).message}`, (err as Error).stack);
    }
  }
}

function buildWelcomeText(input: WelcomeEmailInput, loginUrl: string): string {
  return [
    `Hi ${input.displayName},`,
    "",
    "An account has been created for you on ORELIA CRM.",
    "",
    `Username: ${input.username}`,
    `Temporary password: ${input.temporaryPassword}`,
    "",
    `Log in here: ${loginUrl}`,
    "",
    "You'll be asked to set a new password the first time you sign in.",
  ].join("\n");
}

// Brand red is hardcoded here (not var(--color-crm-primary)) deliberately --
// this is raw HTML handed to SendGrid, rendered by mail clients with no
// guaranteed CSS custom property support, unlike every frontend component.
function buildWelcomeHtml(input: WelcomeEmailInput, loginUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #0F172A; max-width: 480px;">
      <h2 style="color: #022B5D; margin-bottom: 4px;">Welcome to ORELIA CRM</h2>
      <p>Hi ${escapeHtml(input.displayName)},</p>
      <p>An account has been created for you.</p>
      <table style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #64748b;">Username</td>
          <td><strong>${escapeHtml(input.username)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #64748b;">Temporary password</td>
          <td><strong>${escapeHtml(input.temporaryPassword)}</strong></td>
        </tr>
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #ED1B24; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Log in
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px;">You'll be asked to set a new password the first time you sign in.</p>
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
