import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn, 
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    OneToMany
  } from 'typeorm';
  import { User } from './user.entity';
  
  export enum DriverStatus {
    OFFLINE = 'offline',
    ONLINE = 'online',
    BUSY = 'busy',
    BREAK = 'break'
  }
  
  export enum CarClass {
    PREMIUM = 'premium',
    PREMIUM_LARGE = 'premium_large',
    ELITE = 'elite'
  }
  
  @Entity('drivers')
  export class Driver {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
  
    @OneToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user!: User;
  
    @Column({ name: 'car_class', type: 'enum', enum: CarClass })
    carClass!: CarClass;
  
    @Column({ 
      name: 'status', 
      type: 'enum', 
      enum: DriverStatus, 
      default: DriverStatus.OFFLINE 
    })
    status!: DriverStatus;
  
    @Column({ 
      name: 'car_info', 
      type: 'jsonb' 
    })
    carInfo!: {
      model: string;
      number: string;
      year: number;
      color: string;
    };
  
    @Column({
      name: 'rating',
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