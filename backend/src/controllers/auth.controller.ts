// src/controllers/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Logger,
  Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService, UserRole } from '../services/auth.service';
import { TelegramLoginDto, RefreshTokenDto } from '../dto/auth.dto';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { Public } from '../decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('telegram/client')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Аутентификация клиента через Telegram Mini App' })
  @RateLimit({ points: 5, duration: 60, keyPrefix: 'auth:telegram:client' })
  async clientLogin(
    @Body(new ValidationPipe({ transform: true })) 
    loginData: TelegramLoginDto
  ) {
    try {
      return await this.authService.authenticateMiniApp(loginData, UserRole.CLIENT);
    } catch (error) {
      this.logger.error(
        `Ошибка аутентификации клиента ${loginData.id}: ${error.message}`,
        error.stack
      );
      throw new UnauthorizedException('Ошибка аутентификации');
    }
  }

  @Public()
  @Post('telegram/driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Аутентификация водителя через Telegram Mini App' })
  @RateLimit({ points: 5, duration: 60, keyPrefix: 'auth:telegram:driver' })
  async driverLogin(
    @Body(new ValidationPipe({ transform: true })) 
    loginData: TelegramLoginDto
  ) {
    try {
      return await this.authService.authenticateMiniApp(loginData, UserRole.DRIVER);
    } catch (error) {
      this.logger.error(
        `Ошибка аутентификации водителя ${loginData.id}: ${error.message}`,
        error.stack
      );
      throw new UnauthorizedException('Ошибка аутентификации');
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление токенов' })
  @RateLimit({ points: 10, duration: 60, keyPrefix: 'auth:refresh' })
  async refreshTokens(@Body(ValidationPipe) refreshTokenDto: RefreshTokenDto) {
    try {
      const tokens = await this.authService.refreshToken(refreshTokenDto.refreshToken);
      return { tokens };
    } catch (error) {
      this.logger.error(`Ошибка обновления токена: ${error.message}`);
      throw new UnauthorizedException('Недействительный refresh token');
    }
  }
}