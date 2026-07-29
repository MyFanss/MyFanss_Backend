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
