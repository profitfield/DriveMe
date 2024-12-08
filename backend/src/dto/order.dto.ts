// src/dto/order.dto.ts

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
  IsBoolean,
  IsArray
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

  @ApiProperty({ required: false })
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

export class OrderFilterDto {
  @ApiProperty({ enum: OrderStatus, required: false })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ enum: OrderType, required: false })
  @IsEnum(OrderType)
  @IsOptional()
  type?: OrderType;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class PaginatedOrdersResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  @ValidateNested({ each: true })
  @Type(() => OrderResponseDto)
  items!: OrderResponseDto[];

  @ApiProperty()
  @IsNumber()
  total!: number;

  @ApiProperty()
  @IsNumber()
  page!: number;

  @ApiProperty()
  @IsNumber()
  limit!: number;

  @ApiProperty()
  @IsNumber()
  pages!: number;
}

export class OrderPriceResponseDto {
  @ApiProperty()
  @IsNumber()
  basePrice!: number;

  @ApiProperty()
  @IsNumber()
  discount!: number;

  @ApiProperty()
  @IsNumber()
  finalPrice!: number;

  @ApiProperty()
  @IsNumber()
  commission!: number;

  @ApiProperty({ type: 'object' })
  @IsObject()
  details!: {
      hourlyRate?: number;
      duration?: number;
      discountPercent?: number;
      airportFee?: number;
  };
}

export class RateOrderDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class OrderStatisticsDto {
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
  totalAmount!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating!: number;

  @ApiProperty({ type: 'object' })
  @IsObject()
  monthlyStatistics!: {
      ordersCount: number;
      completedCount: number;
      totalAmount: number;
  };
}

export class DriverOrderStatisticsDto extends OrderStatisticsDto {
  @ApiProperty()
  @IsNumber()
  totalEarnings!: number;

  @ApiProperty()
  @IsNumber()
  averageEarningPerOrder!: number;

  @ApiProperty({ type: 'object' })
  @IsObject()
  todayStatistics!: {
      ordersCount: number;
      earnings: number;
  };
}