// src/dto/price.dto.ts

import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderType } from '../entities/order.entity';
import { CarClass } from '../entities/driver.entity';

export class CalculatePriceDto {
  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  carClass: CarClass;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  durationHours?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  airport?: 'SVO' | 'DME' | 'VKO';
}

export class PriceResponseDto {
  @ApiProperty()
  @IsNumber()
  basePrice: number;

  @ApiProperty()
  @IsNumber()
  discount: number;

  @ApiProperty()
  @IsNumber()
  finalPrice: number;

  @ApiProperty()
  @IsNumber()
  commission: number;
}