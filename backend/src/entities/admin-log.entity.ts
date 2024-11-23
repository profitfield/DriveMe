import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AdminUser } from './admin-user.entity';

export enum AdminActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  SETTINGS = 'settings',
  STATUS = 'status'
}

@Entity('admin_logs')
export class AdminLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'admin_id' })
  admin!: AdminUser;

  @Column({
    type: 'enum',
    enum: AdminActionType
  })
  action!: AdminActionType;

  @Column({ type: 'jsonb' })
  details!: Record<string, any>;

  @Column({ nullable: true })
  entityType?: string;

  @Column({ nullable: true })
  entityId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}