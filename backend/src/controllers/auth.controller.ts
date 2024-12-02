// src/controllers/auth.controller.ts

import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { TelegramLoginDto, TelegramAuthResponseDto } from '../dto/auth.dto';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { rateLimitConfig } from '../config/rate-limit.config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Authenticate user via Telegram' })
  @ApiResponse({ 
    status: 201, 
    description: 'Successfully authenticated',
    type: TelegramAuthResponseDto
  })
  @RateLimit(rateLimitConfig.auth.telegram)
  async telegramLogin(
    @Body(ValidationPipe) loginData: TelegramLoginDto
  ): Promise<TelegramAuthResponseDto> {
    return this.authService.validateTelegramLogin(loginData);
  }
}