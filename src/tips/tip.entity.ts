import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TipStatus } from './enums/tip-status.enum';

@Entity('tips')
@Index(['creatorId', 'status', 'createdAt'])
@Index(['fanId', 'status', 'createdAt'])
export class Tip {
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

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ type: 'enum', enum: TipStatus, default: TipStatus.PENDING })
  status: TipStatus;

  @Column({ type: 'varchar', unique: true })
  idempotencyKey: string;

  @Column({ type: 'int' })
  feeCents: number;

  @Column({ type: 'int' })
  creatorNetCents: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;
}
