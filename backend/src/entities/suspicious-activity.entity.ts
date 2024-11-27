import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { ActivityType, RiskLevel, ActionTaken } from '../services/suspicious-activity.service';

@Entity('suspicious_activities')
export class SuspiciousActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActivityType
  })
  type: ActivityType;

  @Column({
    type: 'enum',
    enum: RiskLevel
  })
  riskLevel: RiskLevel;

  @Column({
    type: 'enum',
    enum: ActionTaken
  })
  actionTaken: ActionTaken;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: ['client', 'driver', 'admin'],
    nullable: true
  })
  userType?: 'client' | 'driver' | 'admin';

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({ nullable: true })
  ip?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ name: 'request_path', nullable: true })
  requestPath?: string;

  @Column({ name: 'request_method', nullable: true })
  requestMethod?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}