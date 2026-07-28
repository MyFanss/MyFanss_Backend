import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReportTargetType } from './enums/report-target-type.enum';
import { ReportStatus } from './enums/report-status.enum';

@Entity('content_reports')
@Index(['status', 'createdAt'])
@Index(['reporterId', 'targetType', 'targetId'])
export class ContentReport {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column({ type: 'int' })
  reporterId: number;

  @Column({ type: 'enum', enum: ReportTargetType })
  targetType: ReportTargetType;

  @Column({ type: 'int' })
  targetId: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  @Column({ type: 'int', nullable: true })
  resolvedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
