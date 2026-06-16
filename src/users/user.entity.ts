import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index(['role'])
@Index(['status'])
@Index(['org_id'])
@Index(['created_at'])
@Index(['status', 'created_at', 'id'])
@Index(['org_id', 'created_at', 'id'])
@Index(['role', 'status', 'created_at', 'id'])
export class User {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @Column()
  name: string;

  @Column({ unique: true, type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'varchar', default: 'user' })
  role: string;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ type: 'int', nullable: true })
  org_id: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @Column({ type: 'tsvector', nullable: true })
  search_text: string;
}
