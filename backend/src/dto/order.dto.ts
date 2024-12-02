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
  IsUUID
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderType, OrderStatus } from '../entities/order.entity';
import { CarClass } from '../entities/driver.entity';

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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class OrderPriceDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  discount!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  finalPrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  commission!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  total!: number;
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
}

export class OrderResponseDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

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
  @Min(0)
  price!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  commission!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  driver?: {
    id: string;
    name: string;
    phone: string;
    carInfo: {
      model: string;
      number: string;
      color: string;
    };
    rating: number;
  };
}

export class OrderStatsDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  total!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  completed!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  cancelled!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  revenue!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  completionRate!: number;

  @ApiProperty()
  todayOrders?: {
    total: number;
    completed: number;
    revenue: number;
  };
}