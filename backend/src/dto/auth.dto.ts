// src/dto/auth.dto.ts

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

  @ApiProperty()
  @IsNumber()
  auth_date: number;

  @ApiProperty()
  @IsString()
  hash: string;
}

export class TelegramAuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      telegramId: { type: 'string' },
      firstName: { type: 'string', nullable: true },
      lastName: { type: 'string', nullable: true },
      username: { type: 'string', nullable: true },
      role: { type: 'string', enum: ['client', 'driver'] }
    }
  })
  user: {
    id: string;
    telegramId: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    role: 'client' | 'driver';
  };
}