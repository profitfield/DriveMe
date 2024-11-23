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
    // В режиме разработки пропускаем проверку хэша
    if (process.env.NODE_ENV === 'development') {
      // Пропускаем проверку
    } else {
      // Проверяем валидность данных от Telegram
      if (!this.verifyTelegramHash(loginData)) {
        throw new UnauthorizedException('Invalid telegram authentication data');
      }
    }

    // Проверяем время авторизации (отключаем в режиме разработки)
    if (process.env.NODE_ENV !== 'development' && loginData.auth_date < (Date.now() / 1000 - 86400)) {
      throw new UnauthorizedException('Authentication data expired');
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

    // Генерируем токен
    const token = await this.jwtService.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: 'client'
      }
    };
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