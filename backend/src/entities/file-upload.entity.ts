import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum FileStatus {
  PENDING = 'pending',
  SCANNING = 'scanning',
  CLEAN = 'clean',
  INFECTED = 'infected',
  ERROR = 'error'
}

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  category: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column()
  filename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column('bigint')
  size: number;

  @Column()
  checksum: string;

  @Column()
  path: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PENDING
  })
  scanStatus: FileStatus;

  @Column({ type: 'jsonb', nullable: true })
  scanResult?: {
    timestamp: Date;
    viruses?: string[];
    error?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt?: Date;
}