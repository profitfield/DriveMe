import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { AuditActionType, AuditLogLevel } from '../services/audit.service';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryColumn()
  id: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: AuditActionType,
    name: 'action_type'
  })
  actionType: AuditActionType;

  @Column({
    type: 'enum',
    enum: AuditLogLevel,
  })
  level: AuditLogLevel;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'user_type', nullable: true })
  userType?: 'client' | 'driver' | 'admin';

  @Column({ name: 'resource_id', nullable: true })
  resourceId?: string;

  @Column({ name: 'resource_type', nullable: true })
  resourceType?: string;

  @Column({ type: 'jsonb', name: 'old_value', nullable: true })
  oldValue?: any;

  @Column({ type: 'jsonb', name: 'new_value', nullable: true })
  newValue?: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  ip?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({
    type: 'enum',
    enum: ['success', 'failure'],
    default: 'success'
  })
  status: 'success' | 'failure';

  @Column({ name: 'error_details', type: 'text', nullable: true })
  errorDetails?: string;
}