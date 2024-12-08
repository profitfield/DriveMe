// src/entities/order.entity.ts

import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn, 
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from './user.entity';
import { Driver } from './driver.entity';
import { CarClass } from './driver.entity';

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

export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded'
}

@Entity('orders')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'order_number', unique: true })
    orderNumber!: string;

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
    @Index()
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
    pickupAddress!: {
        address: string;
        latitude: number;
        longitude: number;
    };

    @Column({
        type: 'jsonb',
        name: 'destination_address',
        nullable: true
    })
    destinationAddress?: {
        address: string;
        latitude: number;
        longitude: number;
    };

    @Column({
        name: 'duration_hours',
        type: 'integer',
        nullable: true
    })
    durationHours?: number;

    @Column({
        name: 'estimated_price',
        type: 'decimal',
        precision: 10,
        scale: 2
    })
    estimatedPrice!: number;

    @Column({
        name: 'actual_price',
        type: 'decimal',
        precision: 10,
        scale: 2,
        nullable: true
    })
    actualPrice?: number;

    @Column({
        type: 'decimal',
        precision: 10,
        scale: 2
    })
    commission!: number;

    @Column({
        name: 'payment_type',
        type: 'enum',
        enum: PaymentType,
        default: PaymentType.CASH
    })
    paymentType!: PaymentType;

    @Column({
        name: 'payment_status',
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING
    })
    paymentStatus!: PaymentStatus;

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

    @Column({
        type: 'decimal',
        precision: 2,
        scale: 1,
        nullable: true
    })
    rating?: number;

    @Column({
        name: 'rating_comment',
        type: 'text',
        nullable: true
    })
    ratingComment?: string;

    @Column({
        name: 'confirmed_at',
        type: 'timestamp with time zone',
        nullable: true
    })
    confirmedAt?: Date;

    @Column({
        name: 'started_at',
        type: 'timestamp with time zone',
        nullable: true
    })
    startedAt?: Date;

    @Column({
        name: 'completed_at',
        type: 'timestamp with time zone',
        nullable: true
    })
    completedAt?: Date;

    @Column({
        name: 'cancelled_at',
        type: 'timestamp with time zone',
        nullable: true
    })
    cancelledAt?: Date;

    @Column({
        name: 'start_location',
        type: 'jsonb',
        nullable: true
    })
    startLocation?: {
        latitude: number;
        longitude: number;
    };

    @Column({
        name: 'estimated_arrival_time',
        type: 'timestamp with time zone',
        nullable: true
    })
    estimatedArrivalTime?: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}