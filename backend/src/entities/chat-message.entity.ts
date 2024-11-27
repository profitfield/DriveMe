import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ['text', 'location', 'system'],
    default: 'text'
  })
  type: 'text' | 'location' | 'system';

  @Column({
    type: 'enum',
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  })
  status: 'sent' | 'delivered' | 'read';

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}