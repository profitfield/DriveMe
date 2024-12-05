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

export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded'
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

    @Column({ 
        name: 'order_number',
        unique: true,
        nullable: false
    })
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
        name: 'estimated_price',
        type: 'decimal',
        precision: 10,
        scale: 2,
        nullable: false,
        default: 0.00
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
        name: 'rating',
        type: 'decimal',
        precision: 2,
        scale: 1,
        nullable: true,
        comment: 'Оценка поездки клиентом от 1.0 до 5.0'
    })
    rating?: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}