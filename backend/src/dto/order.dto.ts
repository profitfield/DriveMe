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
  IsLongitude
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, OrderStatus } from '../entities/order.entity';
import { CarClass } from '../entities/driver.entity';

export class AddressDto {
  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  @IsNotEmpty()
  type!: OrderType;

  @IsEnum(CarClass)
  @IsNotEmpty()
  carClass!: CarClass;

  @IsDateString()
  @IsNotEmpty()
  pickupDatetime!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress!: AddressDto;

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => AddressDto)
  destinationAddress?: AddressDto;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(12)
  durationHours?: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status!: OrderStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class OrderResponseDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsEnum(CarClass)
  carClass!: CarClass;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  commission!: number;

  @IsDateString()
  pickupDatetime!: Date;

  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress!: AddressDto;

  @ValidateNested()
  @IsOptional()
  @Type(() => AddressDto)
  destinationAddress?: AddressDto;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(12)
  durationHours?: number;
}