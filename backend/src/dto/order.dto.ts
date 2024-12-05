// backend/src/dto/order.dto.ts

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
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
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