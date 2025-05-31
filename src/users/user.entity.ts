import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('identity')
  id: number;
  @Column()
  name: string;
  @Column({ unique: true, type: 'varchar' })
  email: string;
  @Column({ type: 'varchar' })
  password: string;
}
