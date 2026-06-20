import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Index()
  @Column({ type: 'int', unique: true })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'boolean', default: true })
  newSubscriber: boolean;

  @Column({ type: 'boolean', default: true })
  postFromSubscribedCreator: boolean;

  @Column({ type: 'boolean', default: true })
  securityAlerts: boolean;

  @Column({ type: 'boolean', default: false })
  marketing: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
