import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('conversations')
@Unique('UQ_CONVERSATION_FAN_CREATOR', ['fanId', 'creatorId'])
@Index(['fanId', 'lastMessageAt'])
@Index(['creatorId', 'lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column({ type: 'int' })
  fanId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fanId' })
  fan: User;

  @Column({ type: 'int' })
  creatorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column({ type: 'timestamp' })
  lastMessageAt: Date;

  @Column({ type: 'varchar', length: 160, nullable: true })
  lastMessagePreview: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
