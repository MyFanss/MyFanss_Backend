import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type SubscriptionStatus = 'active' | 'cancelled';

@Entity('subscriptions')
// One row per fan+creator pair. Re-subscribing reactivates the same row, so a
// plain unique constraint on the pair also guarantees a single active row.
@Index(['fanId', 'creatorId'], { unique: true })
@Index(['creatorId', 'status'])
@Index(['fanId', 'status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  fanId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  fan: User;

  @Column({ type: 'int' })
  creatorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  creator: User;

  @Column({ type: 'varchar', default: 'active' })
  status: SubscriptionStatus;

  @CreateDateColumn({ type: 'timestamp' })
  subscribedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;
}
