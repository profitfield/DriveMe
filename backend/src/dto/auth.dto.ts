import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class TelegramLoginDto {
  @ApiProperty()
  @IsNumber()
  id: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photo_url?: string;

  @ApiProperty()
  @IsNumber()
  auth_date: number;

  @ApiProperty()
  @IsString()
  hash: string;
}

export class TelegramAuthResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  user: {
    id: string;
    telegramId: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    role: 'client' | 'driver';
  };
}