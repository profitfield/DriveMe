import { 
  IsEnum, 
  IsNotEmpty, 
  IsString, 
  IsNumber, 
  IsObject, 
  IsOptional, 
  IsDateString, 
  Min, 
  Max, 
  ValidateNested,
  IsLatitude,
  IsLongitude,
  IsUUID,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderType, OrderStatus, PaymentType, PaymentStatus } from '../entities/order.entity';
import { CarClass, DriverStatus } from '../entities/driver.entity';

export class AddressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;
}

export class CreateOrderDto {
  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  @IsNotEmpty()
  type!: OrderType;

  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  @IsNotEmpty()
  carClass!: CarClass;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  pickupDatetime!: string;

  @ApiProperty({ type: AddressDto })
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress!: AddressDto;

  @ApiProperty({ type: AddressDto, required: false })
  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => AddressDto)
  destinationAddress?: AddressDto;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(12)
  durationHours?: number;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType = PaymentType.CASH;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  bonusPayment?: number;
  
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  useFavoriteDriver?: boolean;
}

export class OrderStatusMetadataDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, any>;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status!: OrderStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ type: OrderStatusMetadataDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderStatusMetadataDto)
  metadata?: OrderStatusMetadataDto;
}

export class MonthlyStatisticsDto {
  @ApiProperty()
  @IsNumber()
  ordersCount!: number;

  @ApiProperty()
  @IsNumber()
  completedCount!: number;

  @ApiProperty()
  @IsNumber()
  totalAmount!: number;
}

export class ClientOrderStatisticsDto {
  @ApiProperty()
  @IsNumber()
  totalOrders!: number;

  @ApiProperty()
  @IsNumber()
  completedOrders!: number;

  @ApiProperty()
  @IsNumber()
  cancelledOrders!: number;

  @ApiProperty()
  @IsNumber()
  totalSpent!: number;

  @ApiProperty()
  @IsNumber()
  averageOrderCost!: number;

  @ApiProperty({ type: MonthlyStatisticsDto })
  @ValidateNested()
  @Type(() => MonthlyStatisticsDto)
  lastMonthStatistics!: MonthlyStatisticsDto;

  @ApiProperty()
  @IsString()
  completionRate!: string;
}

export class DriverDailyStatisticsDto {
  @ApiProperty()
  @IsNumber()
  ordersCount!: number;

  @ApiProperty()
  @IsNumber()
  earnings!: number;
}

export class DriverOrderStatisticsDto {
  @ApiProperty()
  @IsNumber()
  totalOrders!: number;

  @ApiProperty()
  @IsNumber()
  completedOrders!: number;

  @ApiProperty()
  @IsNumber()
  cancelledOrders!: number;

  @ApiProperty()
  @IsNumber()
  totalEarned!: number;

  @ApiProperty()
  @IsNumber()
  averageOrderEarning!: number;

  @ApiProperty({ type: MonthlyStatisticsDto })
  @ValidateNested()
  @Type(() => MonthlyStatisticsDto)
  lastMonthStatistics!: MonthlyStatisticsDto;

  @ApiProperty({ type: DriverDailyStatisticsDto })
  @ValidateNested()
  @Type(() => DriverDailyStatisticsDto)
  todayStatistics!: DriverDailyStatisticsDto;

  @ApiProperty()
  @IsString()
  completionRate!: string;

  @ApiProperty()
  @IsString()
  averageRating!: string;
}

export class CarInfoDto {
  @ApiProperty()
  @IsString()
  model!: string;

  @ApiProperty()
  @IsString()
  number!: string;

  @ApiProperty()
  @IsString()
  color!: string;
}

export class OrderDriverDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ type: CarInfoDto })
  @ValidateNested()
  @Type(() => CarInfoDto)
  carInfo!: CarInfoDto;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating!: number;

  @ApiProperty({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  status!: DriverStatus;
}

export class OrderResponseDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  orderNumber!: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  carClass!: CarClass;

  @ApiProperty()
  @IsDateString()
  pickupDatetime!: Date;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress!: AddressDto;

  @ApiProperty({ type: AddressDto, required: false })
  @ValidateNested()
  @IsOptional()
  @Type(() => AddressDto)
  destinationAddress?: AddressDto;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(12)
  durationHours?: number;

  @ApiProperty()
  @IsNumber()
  estimatedPrice!: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  actualPrice?: number;

  @ApiProperty()
  @IsNumber()
  commission!: number;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  @IsNumber()
  bonusPayment!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  rating?: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: OrderDriverDto, required: false })
  @ValidateNested()
  @IsOptional()
  @Type(() => OrderDriverDto)
  driver?: OrderDriverDto;
}