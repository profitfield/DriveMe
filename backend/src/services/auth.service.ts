import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { UsersService } from './users.service';
import { JwtService } from './jwt.service';
import { TelegramLoginDto, TelegramAuthResponseDto } from '../dto/auth.dto';
import { BruteforceProtectionService } from './bruteforce-protection.service';
import { SecurityLogger } from './logger.service';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private bruteforceProtection: BruteforceProtectionService,
    private securityLogger: SecurityLogger
  ) {}

  async validateTelegramLogin(loginData: TelegramLoginDto): Promise<TelegramAuthResponseDto> {
    try {
      // В режиме разработки пропускаем проверку хэша
      if (process.env.NODE_ENV !== 'development') {
        // Проверяем валидность данных от Telegram
        if (!this.verifyTelegramHash(loginData)) {
          await this.bruteforceProtection.recordAttempt(loginData.id.toString(), 'auth', false);
          throw new UnauthorizedException('Invalid telegram authentication data');
        }

        // Проверяем время авторизации
        if (loginData.auth_date < (Date.now() / 1000 - 86400)) {
          await this.bruteforceProtection.recordAttempt(loginData.id.toString(), 'auth', false);
          throw new UnauthorizedException('Authentication data expired');
        }
      }

      // Ищем или создаем пользователя
      let user = await this.usersService.findByTelegramId(loginData.id.toString());
      
      if (!user) {
        user = await this.usersService.create({
          telegramId: loginData.id.toString(),
          username: loginData.username,
          firstName: loginData.first_name,
          lastName: loginData.last_name
        });
      }

      // Генерируем токены
      const { accessToken, refreshToken } = await this.jwtService.generateTokens(user.id, user.telegramId, 'client');

      // Записываем успешную попытку
      await this.bruteforceProtection.recordAttempt(loginData.id.toString(), 'auth', true);

      // Логируем успешную авторизацию
      this.securityLogger.logSecurityEvent({
        type: 'auth',
        severity: 'low',
        message: 'Successful Telegram authentication',
        userId: user.id,
        metadata: { telegramId: loginData.id }
      });

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
      // Логируем неудачную попытку
      this.securityLogger.logSecurityEvent({
        type: 'auth',
        severity: 'medium',
        message: 'Failed Telegram authentication',
        metadata: { 
          telegramId: loginData.id,
          error: error.message 
        }
      });
      throw error;
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