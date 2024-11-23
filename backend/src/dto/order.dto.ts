import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsNumber, IsObject, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, OrderStatus } from '../entities/order.entity';
import { CarClass } from '../entities/driver.entity';

export class AddressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty()
  @IsNumber()
  latitude!: number;

  @ApiProperty()
  @IsNumber()
  longitude!: number;
}

export class CreateOrderDto {
  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  carClass!: CarClass;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pickupDatetime!: string;

  @ApiProperty()
  @IsObject()
  @Type(() => AddressDto)
  pickupAddress!: AddressDto;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  @Type(() => AddressDto)
  destinationAddress?: AddressDto;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  durationHours?: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: OrderType })
  type!: OrderType;

  @ApiProperty({ enum: CarClass })
  carClass!: CarClass;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  commission!: number;

  @ApiProperty()
  pickupDatetime!: Date;

  @ApiProperty()
  pickupAddress!: AddressDto;

  @ApiProperty({ required: false })
  destinationAddress?: AddressDto;

  @ApiProperty({ required: false })
  durationHours?: number;
}