import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

@Entity('messages')
@Index(['conversationId', 'id'])
@Index('UQ_MESSAGE_CLIENT_ID', ['conversationId', 'senderId', 'clientId'], {
  unique: true,
  where: '"clientId" IS NOT NULL',
})
export class Message {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column({ type: 'int' })
  conversationId: number;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'int' })
  senderId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  clientId: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}
