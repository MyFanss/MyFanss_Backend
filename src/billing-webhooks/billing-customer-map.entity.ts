import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Side-table choice (vs. columns on Subscription): a Subscription is keyed by
// (fanId, creatorId) and one fan/creator pair may be re-subscribed to across
// its lifetime, but the *external* provider subscription id changes on every
// re-subscribe. Storing externalSubscriptionId directly on Subscription would
// mean overwriting history on every reactivation. Keeping the mapping in its
// own table lets each external subscription id resolve to a local pair
// independently of how many times that pair has subscribed/cancelled.
@Entity('billing_customer_maps')
@Index(['externalSubscriptionId'], { unique: true })
@Index(['externalCustomerId'])
export class BillingCustomerMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  externalCustomerId: string;

  @Column({ type: 'varchar' })
  externalSubscriptionId: string;

  @Column({ type: 'int' })
  fanId: number;

  @Column({ type: 'int' })
  creatorId: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
