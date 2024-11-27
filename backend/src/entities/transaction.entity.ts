import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TransactionType, TransactionStatus } from '../services/secure-transaction.service';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TransactionType
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status: TransactionStatus;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: ['client', 'driver', 'admin']
  })
  userType: 'client' | 'driver' | 'admin';

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'jsonb', name: 'result_data', nullable: true })
  resultData?: Record<string, any>;

  @Column({ name: 'error_message', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}