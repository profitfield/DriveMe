// src/dto/driver.dto.ts

import { 
  IsEnum, 
  IsNotEmpty, 
  IsObject, 
  IsString, 
  IsNumber, 
  IsOptional,
  IsLatitude,
  IsLongitude,
  Min,
  Max,
  ValidateNested,
  IsUUID
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CarClass, DriverStatus } from '../entities/driver.entity';

export class CarInfoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty()
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear())
  year: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  color: string;
}

export class CreateDriverDto {
  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  carClass: CarClass;

  @ApiProperty({ type: CarInfoDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CarInfoDto)
  carInfo: CarInfoDto;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  userId?: string; // Опционально, так как может быть добавлен на бэкенде
}

export class UpdateDriverStatusDto {
  @ApiProperty({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  status: DriverStatus;
}

export class UpdateLocationDto {
  @ApiProperty()
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @IsLongitude()
  longitude: number;
}

export class DriverResponseDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  carClass: CarClass;

  @ApiProperty({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  status: DriverStatus;

  @ApiProperty({ type: CarInfoDto })
  @ValidateNested()
  @Type(() => CarInfoDto)
  carInfo: CarInfoDto;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalRides: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  commissionBalance: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class DriverStatsDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalRides: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalEarnings: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  completionRate: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pendingCommission: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  todayRides?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  todayEarnings?: number;
}

export class DriverLocationDto {
  @ApiProperty()
  @IsUUID()
  driverId: string;

  @ApiProperty()
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @IsLongitude()
  longitude: number;

  @ApiProperty()
  @IsEnum(DriverStatus)
  status: DriverStatus;

  @ApiProperty()
  lastUpdated: Date;
}

export class DriverSearchParamsDto {
  @ApiProperty({ enum: CarClass, required: false })
  @IsEnum(CarClass)
  @IsOptional()
  carClass?: CarClass;

  @ApiProperty({ required: false })
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  radius?: number; // в километрах

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  minRating?: number;
}