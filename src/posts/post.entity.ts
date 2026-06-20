import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

type Visibility = 'public' | 'subscribers';

@Entity('posts')
@Index(['creatorId', 'publishedAt'])
@Index(['visibility', 'publishedAt'])
@Index(['creatorId', 'visibility'])
export class Post {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column()
  creatorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', nullable: true })
  mediaUrl?: string | null;

  @Column({
    type: 'enum',
    enum: ['public', 'subscribers'],
    default: 'public',
  })
  visibility: Visibility;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
