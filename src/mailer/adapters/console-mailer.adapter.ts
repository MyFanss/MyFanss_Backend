import { randomUUID } from 'node:crypto';
import { AppLogger } from '../../logger/app-logger.service';
import { MailerPort, SendMailInput, SendMailResult } from '../mailer.port';
import { isProductionLike, maskEmail, redactSensitive } from '../mailer.util';

/** Dev-mode mailer — logs the email instead of sending it. */
export class ConsoleMailerAdapter implements MailerPort {
  constructor(private readonly logger: AppLogger) {}

  send(input: SendMailInput): Promise<SendMailResult> {
    const redact = isProductionLike();
    const to = redact ? maskEmail(input.to) : input.to;
    const subject = redact ? redactSensitive(input.subject) : input.subject;
    const body = redact ? redactSensitive(input.text) : input.text;

    this.logger.log(
      `[ConsoleMailer] to=${to} subject="${subject}" tags=${JSON.stringify(input.tags ?? {})}\n${body}`,
      ConsoleMailerAdapter.name,
    );

    return Promise.resolve({
      accepted: true,
      messageId: `console-${randomUUID()}`,
    });
  }
}
