import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sessions')
export class Session {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ['client', 'driver', 'admin'],
    name: 'user_type'
  })
  userType: 'client' | 'driver' | 'admin';

  @Column({ type: 'jsonb', name: 'device_info', nullable: true })
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    deviceId?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_activity', type: 'timestamp with time zone' })
  lastActivity: Date;

  @Column({ name: 'terminated_at', type: 'timestamp with time zone', nullable: true })
  terminatedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}