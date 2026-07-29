export interface MailTags {
  [key: string]: string | number | boolean | undefined;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: MailTags;
}

export interface SendMailResult {
  accepted: boolean;
  messageId?: string;
}

/**
 * Port every mailer adapter (console, smtp, future providers) must implement.
 * Consumed only through MailerService — adapters never get called directly
 * by feature code so failure isolation stays centralized.
 */
export interface MailerPort {
  send(input: SendMailInput): Promise<SendMailResult>;
}

export const MAILER_PORT = Symbol('MAILER_PORT');
