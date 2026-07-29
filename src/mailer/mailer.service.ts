import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../logger/app-logger.service';
import { EMAIL_OUTBOX, EmailOutbox } from './email-outbox.port';
import {
  MAILER_PORT,
  MailerPort,
  SendMailInput,
  SendMailResult,
} from './mailer.port';
import { MailerMetrics } from './mailer-metrics.service';
import { maskEmail } from './mailer.util';
import {
  ResetPasswordTemplateParams,
  buildResetPasswordEmail,
} from './templates/reset-password.template';
import {
  NewSubscriberTemplateParams,
  buildNewSubscriberEmail,
} from './templates/new-subscriber.template';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Single entry point feature code should call to send mail. Wraps the
 * underlying MailerPort with a timeout, records the attempt to the outbox,
 * and swallows/logs failures so a broken mail driver never fails the
 * originating HTTP request (password reset always 200s, subscribe always
 * 201s, etc).
 *
 * Hook points for future flows: add a `sendX(to, params)` method following
 * the same pattern as sendPasswordReset/sendNewSubscriberNotification below
 * — build template content, then delegate to `send()`. Tip/message
 * notifications should plug in here the same way once their templates land.
 */
@Injectable()
export class MailerService {
  private readonly timeoutMs: number;

  constructor(
    @Inject(MAILER_PORT) private readonly mailerPort: MailerPort,
    @Inject(EMAIL_OUTBOX) private readonly outbox: EmailOutbox,
    private readonly metrics: MailerMetrics,
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {
    this.timeoutMs =
      this.configService.get<number>('MAILER_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS;
  }

  async sendPasswordReset(
    to: string,
    params: ResetPasswordTemplateParams,
  ): Promise<SendMailResult> {
    const { subject, html, text } = buildResetPasswordEmail(params);
    return this.send({
      to,
      subject,
      html,
      text,
      tags: { template: 'password-reset' },
    });
  }

  async sendNewSubscriberNotification(
    to: string,
    params: NewSubscriberTemplateParams,
  ): Promise<SendMailResult> {
    const { subject, html, text } = buildNewSubscriberEmail(params);
    return this.send({
      to,
      subject,
      html,
      text,
      tags: { template: 'new-subscriber' },
    });
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    const template =
      typeof input.tags?.template === 'string'
        ? input.tags.template
        : undefined;
    const maskedTo = maskEmail(input.to);

    try {
      const result = await this.withTimeout(this.mailerPort.send(input));
      this.metrics.incrementSent(template);
      await this.outbox.record({
        to: maskedTo,
        tags: input.tags,
        status: 'sent',
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.metrics.incrementFailed(template);
      this.logger.error(
        `Mail send failed to=${maskedTo} template=${template ?? 'unknown'}: ${message}`,
        undefined,
        MailerService.name,
      );
      await this.outbox.record({
        to: maskedTo,
        tags: input.tags,
        status: 'failed',
        error: message,
      });
      return { accepted: false };
    }
  }

  private withTimeout(
    promise: Promise<SendMailResult>,
  ): Promise<SendMailResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Mailer send timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }
}
