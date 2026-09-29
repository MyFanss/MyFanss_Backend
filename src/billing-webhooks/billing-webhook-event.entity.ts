import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type BillingWebhookEventStatus =
  | 'processing'
  | 'processed'
  | 'ignored'
  | 'failed';

export type WebhookEventStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'dead';

@Entity('billing_webhook_events')
@Index(['eventId'], { unique: true })
@Index(['status', 'receivedAt'])
export class BillingWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Provider-issued event id (e.g. Stripe's evt_...). Uniqueness on this
  // column is what makes redelivery idempotent.
  @Column({ type: 'varchar' })
  eventId: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'processing' })
  status: BillingWebhookEventStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  // Whether a signature header was present on the request. We deliberately
  // do not persist the raw signature value — it is a secret-derived MAC and
  // has no operational value once verified.
  @Column({ type: 'boolean', default: false })
  signaturePresent: boolean;

  @Column({ type: 'int', nullable: true })
  processingLatencyMs: number | null;

  @Column({ type: 'int', default: 0 })
  deliveryAttempts: number;

  @CreateDateColumn({ type: 'timestamp' })
  receivedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;
}

// Transactional outbox for platform events destined for partner webhooks.
// Rows are written in the same DB transaction as the domain change so that
// an event is never lost if the dispatcher sink is unavailable.
@Entity('webhook_events')
@Index(['status', 'nextAttemptAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'pending' })
  status: WebhookEventStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  nextAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;
}
