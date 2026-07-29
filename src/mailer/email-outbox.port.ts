export interface EmailOutboxRecord {
  id: string;
  to: string;
  status: 'sent' | 'failed';
  tags?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
}

/**
 * Outbox row writer. In-process/sync today (InMemoryEmailOutbox); swap for a
 * TypeORM-backed implementation to enable real async/retry delivery later
 * without touching MailerService or any call site.
 */
export interface EmailOutbox {
  record(
    entry: Omit<EmailOutboxRecord, 'id' | 'createdAt'>,
  ): Promise<EmailOutboxRecord>;
}

export const EMAIL_OUTBOX = Symbol('EMAIL_OUTBOX');
