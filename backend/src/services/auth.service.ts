// src/services/auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { UsersService } from './users.service';
import { JwtService } from './jwt.service';
import { TelegramLoginDto, TelegramAuthResponseDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateTelegramLogin(loginData: TelegramLoginDto): Promise<TelegramAuthResponseDto> {
    try {
      if (process.env.NODE_ENV !== 'development') {
        if (!this.verifyTelegramHash(loginData)) {
          throw new UnauthorizedException('Invalid telegram authentication data');
        }

        if (loginData.auth_date < (Date.now() / 1000 - 86400)) {
          throw new UnauthorizedException('Authentication data expired');
        }
      }

      let user = await this.usersService.findByTelegramId(loginData.id.toString());
      
      if (!user) {
        user = await this.usersService.create({
          telegramId: loginData.id.toString(),
          username: loginData.username,
          firstName: loginData.first_name,
          lastName: loginData.last_name
        });
      }

      const { accessToken, refreshToken } = await this.jwtService.generateTokens(
        user.id,
        user.telegramId,
        'client'
      );

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: 'client'
        }
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  private verifyTelegramHash(data: TelegramLoginDto): boolean {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    const secret = createHash('sha256')
      .update(botToken)
      .digest();

    const checkString = Object.entries(data)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const hash = createHash('sha256')
      .update(checkString)
      .digest('hex');

    return hash === data.hash;
  }
}