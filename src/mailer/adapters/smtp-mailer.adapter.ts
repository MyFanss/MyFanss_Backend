import { randomUUID } from 'node:crypto';
import { AppLogger } from '../../logger/app-logger.service';
import { MailerPort, SendMailInput, SendMailResult } from '../mailer.port';

/** Shape mirrors nodemailer's createTransport(SMTPTransport.Options) config. */
export interface SmtpMailerConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
}

interface SmtpTransportLike {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId: string }>;
}

/**
 * SMTP adapter stub. Lazily requires `nodemailer` so the dependency stays
 * optional until a real deploy sets MAILER_DRIVER=smtp; in test/no-package
 * environments it falls back to an in-memory no-op transport so `connect`
 * never touches the network.
 */
export class SmtpMailerAdapter implements MailerPort {
  private transport: SmtpTransportLike | null = null;

  constructor(
    private readonly config: SmtpMailerConfig,
    private readonly logger: AppLogger,
  ) {}

  private getTransport(): SmtpTransportLike {
    if (this.transport) return this.transport;

    if (process.env.NODE_ENV === 'test') {
      this.transport = this.buildNoopTransport();
      return this.transport;
    }

    try {
      // Optional peer dependency — only required for real SMTP delivery.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as {
        createTransport: (opts: SmtpMailerConfig) => SmtpTransportLike;
      };
      this.transport = nodemailer.createTransport(this.config);
    } catch {
      this.logger.warn(
        '[SmtpMailer] nodemailer package not installed — falling back to no-op transport',
        SmtpMailerAdapter.name,
      );
      this.transport = this.buildNoopTransport();
    }

    return this.transport;
  }

  private buildNoopTransport(): SmtpTransportLike {
    return {
      sendMail: () =>
        Promise.resolve({ messageId: `smtp-noop-${randomUUID()}` }),
    };
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    const transport = this.getTransport();
    const result = await transport.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { accepted: true, messageId: result.messageId };
  }
}
