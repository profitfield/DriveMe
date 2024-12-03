// src/entities/order.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { User } from './user.entity';
import { Driver, CarClass } from './driver.entity';

export enum OrderType {
  PRE_ORDER = 'pre_order',
  HOURLY = 'hourly',
  AIRPORT = 'airport'
}

export enum OrderStatus {
  CREATED = 'created',
  DRIVER_ASSIGNED = 'driver_assigned',
  CONFIRMED = 'confirmed',
  EN_ROUTE = 'en_route',
  ARRIVED = 'arrived',
  STARTED = 'started',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum PaymentType {
  CASH = 'cash',
  BONUS = 'bonus',
  MIXED = 'mixed'
}

interface Address {
  address: string;
  latitude: number;
  longitude: number;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'client_id' })
  client!: User;

  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driver_id' })
  driver?: Driver;

  @Column({
    type: 'enum',
    enum: OrderType
  })
  type!: OrderType;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.CREATED
  })
  status!: OrderStatus;

  @Column({
    name: 'car_class',
    type: 'enum',
    enum: CarClass
  })
  carClass!: CarClass;

  @Column({ 
    name: 'pickup_datetime',
    type: 'timestamp with time zone'
  })
  pickupDatetime!: Date;

  @Column({
    type: 'jsonb',
    name: 'pickup_address'
  })
  pickupAddress!: Address;

  @Column({
    type: 'jsonb',
    name: 'destination_address',
    nullable: true
  })
  destinationAddress?: Address;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2
  })
  price!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2
  })
  commission!: number;

  @Column({
    name: 'duration_hours',
    type: 'integer',
    nullable: true
  })
  durationHours?: number;

  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.CASH
  })
  paymentType!: PaymentType;

  @Column({
    name: 'bonus_payment',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0
  })
  bonusPayment!: number;

  @Column({
    name: 'cancellation_reason',
    type: 'text',
    nullable: true
  })
  cancellationReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}