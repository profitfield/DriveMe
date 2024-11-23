import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsEnum, IsOptional, MinLength, IsUUID, IsDateString, IsNumber } from 'class-validator';
import { AdminRole } from '../entities/admin-user.entity';
import { OrderStatus } from '../entities/order.entity';
import { DriverStatus, CarClass } from '../entities/driver.entity';

// Admin User DTOs
export class CreateAdminDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  role!: AdminRole;
}

export class UpdateAdminDto {
  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ enum: AdminRole, required: false })
  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;
}

// Auth DTOs
export class AdminLoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

// Order Filters DTO
export class OrderFiltersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  driverId?: string;
}

// Driver Filters DTO
export class DriverFiltersDto {
  @ApiProperty({ required: false, enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiProperty({ required: false, enum: CarClass })
  @IsOptional()
  @IsEnum(CarClass)
  carClass?: CarClass;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  rating?: number;
}

// Update Driver Status DTO
export class UpdateDriverStatusDto {
  @ApiProperty({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  status!: DriverStatus;

  @ApiProperty()
  @IsUUID()
  adminId!: string;
}