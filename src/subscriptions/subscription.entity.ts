import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('subscriptions')
@Index(['creatorId'])
@Index(['subscriberId'])
@Index(['status'])
export class Subscription {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column({ type: 'int', name: 'creator_id' })
  creatorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ type: 'int', name: 'subscriber_id' })
  subscriberId: number;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'cancelled_at', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  referrer?: string | null;
}
