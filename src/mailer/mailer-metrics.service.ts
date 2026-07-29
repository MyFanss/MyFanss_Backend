import { Injectable } from '@nestjs/common';

export interface MailerMetricsSnapshot {
  sent: number;
  failed: number;
  byTemplate: Record<string, { sent: number; failed: number }>;
}

/**
 * Stub metrics collector — in-memory counters so failure isolation is
 * observable in tests without pulling in the Prometheus registry. Swap the
 * body for @willsoto/nestjs-prometheus counters when this needs to be scraped.
 */
@Injectable()
export class MailerMetrics {
  private sent = 0;
  private failed = 0;
  private readonly byTemplate = new Map<
    string,
    { sent: number; failed: number }
  >();

  incrementSent(template?: string): void {
    this.sent += 1;
    this.bump(template, 'sent');
  }

  incrementFailed(template?: string): void {
    this.failed += 1;
    this.bump(template, 'failed');
  }

  snapshot(): MailerMetricsSnapshot {
    return {
      sent: this.sent,
      failed: this.failed,
      byTemplate: Object.fromEntries(
        [...this.byTemplate.entries()].map(([key, value]) => [
          key,
          { ...value },
        ]),
      ),
    };
  }

  private bump(template: string | undefined, kind: 'sent' | 'failed'): void {
    if (!template) return;
    const entry = this.byTemplate.get(template) ?? { sent: 0, failed: 0 };
    entry[kind] += 1;
    this.byTemplate.set(template, entry);
  }
}
