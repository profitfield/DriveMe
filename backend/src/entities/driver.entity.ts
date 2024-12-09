// src/entities/driver.entity.ts

import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  OneToOne,
  JoinColumn
} from 'typeorm';
import { User } from './user.entity';

export enum CarClass {
  PREMIUM = 'premium',
  PREMIUM_LARGE = 'premium_large',
  ELITE = 'elite'
}

export enum DriverStatus {
  OFFLINE = 'offline',
  ONLINE = 'online',
  BUSY = 'busy',
  BREAK = 'break'
}

interface CarInfo {
  model: string;
  number: string;
  year: number;
  color: string;
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'car_class',
    type: 'enum',
    enum: CarClass
  })
  carClass!: CarClass;

  @Column({ 
    type: 'enum',
    enum: DriverStatus,
    default: DriverStatus.OFFLINE 
  })
  status!: DriverStatus;

  @Column({ 
    type: 'jsonb',
    name: 'car_info'
  })
  carInfo!: CarInfo;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 5.00
  })
  rating!: number;

  @Column({
    name: 'commission_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0
  })
  commissionBalance!: number;

  @Column({
    name: 'total_rides',
    type: 'integer',
    default: 0
  })
  totalRides!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}