// src/services/telegram-auth.service.ts

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac } from 'crypto';
import { UsersService } from './users.service';
import { TelegramLoginDto } from '../dto/auth.dto';

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async validateTelegramLogin(loginData: TelegramLoginDto) {
    try {
      // Проверяем данные
      if (!this.verifyTelegramData(loginData)) {
        throw new UnauthorizedException('Invalid telegram authentication data');
      }

      // Проверяем срок действия авторизации (не более 24 часов)
      if (this.isAuthExpired(loginData.auth_date)) {
        throw new UnauthorizedException('Authentication data expired');
      }

      // Ищем или создаем пользователя
      let user = await this.usersService.findByTelegramId(loginData.id.toString());
      
      if (!user) {
        // Создаем нового пользователя
        user = await this.usersService.create({
          telegramId: loginData.id.toString(),
          username: loginData.username,
          firstName: loginData.first_name,
          lastName: loginData.last_name,
        });
      }

      // Генерируем JWT токены
      const accessToken = this.jwtService.sign({
        sub: user.id,
        telegramId: user.telegramId,
        type: 'access',
      });

      const refreshToken = this.jwtService.sign({
        sub: user.id,
        telegramId: user.telegramId,
        type: 'refresh',
      }, {
        expiresIn: '30d',
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };

    } catch (error) {
      this.logger.error(`Telegram auth error: ${error.message}`, error.stack);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private verifyTelegramData(data: TelegramLoginDto): boolean {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const secretKey = createHash('sha256')
      .update(botToken)
      .digest();

    const dataToCheck = Object.entries(data)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const hash = createHmac('sha256', secretKey)
      .update(dataToCheck)
      .digest('hex');

    return data.hash === hash;
  }

  private isAuthExpired(authDate: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (now - authDate) > 86400; // 24 часа
  }
}