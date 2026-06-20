import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Public creator identity layered on top of the base User record (1:1).
 *
 * A User exists for every account; a CreatorProfile only exists once that user
 * onboards as a creator. The handle is the public, URL-safe identifier used in
 * discovery flows and is unique across all creators.
 */
@Entity('creator_profiles')
@Index(['userId'], { unique: true })
@Index(['handle'], { unique: true })
export class CreatorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 30, unique: true })
  handle: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  bannerUrl: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @Column({ type: 'boolean', default: false })
  isOnboarded: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
