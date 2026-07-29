import { escapeHtml } from '../mailer.util';
import { EmailContent } from './email-content.type';

export interface ResetPasswordTemplateParams {
  name: string;
  resetUrl: string;
}

export function buildResetPasswordEmail(
  params: ResetPasswordTemplateParams,
): EmailContent {
  const safeName = escapeHtml(params.name);
  const safeUrl = escapeHtml(params.resetUrl);
  const subject = 'Reset your password';

  const html = `<!doctype html>
<html>
  <body style="font-family: sans-serif; line-height: 1.5;">
    <p>Hi ${safeName},</p>
    <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 15 minutes.</p>
    <p><a href="${safeUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;">Reset password</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  </body>
</html>`;

  const text = `Hi ${params.name},

We received a request to reset your password. Use the link below to choose a new one. This link expires in 15 minutes.

${params.resetUrl}

If you didn't request this, you can safely ignore this email.`;

  return { subject, html, text };
}
