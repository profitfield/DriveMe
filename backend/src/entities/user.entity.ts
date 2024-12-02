// src/entities/user.entity.ts

import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ 
    name: 'telegram_id', 
    unique: true 
  })
  telegramId!: string;

  @Column({ 
    name: 'username',
    nullable: true 
  })
  username?: string;

  @Column({ 
    name: 'first_name',
    nullable: true 
  })
  firstName?: string;

  @Column({ 
    name: 'last_name',
    nullable: true 
  })
  lastName?: string;

  @Column({ 
    name: 'phone_number',
    nullable: true 
  })
  phoneNumber?: string;

  @Column({ 
    name: 'bonus_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0 
  })
  bonusBalance!: number;

  @Column({ 
    name: 'referral_code',
    nullable: true,
    unique: true 
  })
  referralCode?: string;

  @CreateDateColumn({ 
    name: 'created_at' 
  })
  createdAt!: Date;

  @UpdateDateColumn({ 
    name: 'updated_at' 
  })
  updatedAt!: Date;
}