import { IsEnum, IsNotEmpty, IsObject, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CarClass, DriverStatus } from '../entities/driver.entity';

export class CreateDriverDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: CarClass })
  @IsEnum(CarClass)
  carClass: CarClass;

  @ApiProperty()
  @IsObject()
  carInfo: {
    model: string;
    number: string;
    year: number;
    color: string;
  };
}

export class UpdateDriverStatusDto {
  @ApiProperty({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  status: DriverStatus;
}