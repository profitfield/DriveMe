// src/services/auth.service.ts

import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac } from 'crypto';
import { UsersService } from './users.service';
import { DriversService } from './drivers.service';
import { TelegramLoginDto } from '../dto/auth.dto';

export enum UserRole {
  CLIENT = 'client',
  DRIVER = 'driver'
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly AUTH_EXPIRATION_TIME = 86400;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
  ) {}

  async authenticateMiniApp(loginData: TelegramLoginDto, role: UserRole) {
    try {
      await this.validateTelegramData(loginData);
      
      // В зависимости от роли используем разную логику обработки
      switch (role) {
        case UserRole.CLIENT:
          return this.handleClientAuth(loginData);
        case UserRole.DRIVER:
          return this.handleDriverAuth(loginData);
        default:
          throw new BadRequestException('Неподдерживаемая роль пользователя');
      }
    } catch (error) {
      this.logger.error(`Ошибка аутентификации Mini App: ${error.message}`);
      throw new UnauthorizedException('Ошибка аутентификации');
    }
  }

  private async handleClientAuth(loginData: TelegramLoginDto) {
    let user = await this.usersService.findByTelegramId(loginData.id.toString());

    if (!user) {
      user = await this.usersService.create({
        telegramId: loginData.id.toString(),
        username: loginData.username,
        firstName: loginData.first_name,
        lastName: loginData.last_name
      });
      this.logger.log(`Создан новый клиент: ${loginData.id}`);
    }

    const tokens = await this.generateTokens(user.id, user.telegramId, UserRole.CLIENT);
    
    return {
      tokens,
      user: this.sanitizeUserData(user),
      role: UserRole.CLIENT
    };
  }

  private async handleDriverAuth(loginData: TelegramLoginDto) {
    let user = await this.usersService.findByTelegramId(loginData.id.toString());
    
    if (!user) {
      throw new UnauthorizedException('Водитель должен быть зарегистрирован администратором');
    }

    const driver = await this.driversService.findByUserId(user.id);
    if (!driver) {
      throw new UnauthorizedException('Пользователь не является водителем');
    }

    const tokens = await this.generateTokens(user.id, user.telegramId, UserRole.DRIVER);

    return {
      tokens,
      user: this.sanitizeUserData(user),
      driver: {
        id: driver.id,
        carClass: driver.carClass,
        status: driver.status
      },
      role: UserRole.DRIVER
    };
  }

  private async validateTelegramData(data: TelegramLoginDto): Promise<void> {
    if (this.isAuthExpired(data.auth_date)) {
      throw new UnauthorizedException('Срок действия данных аутентификации истек');
    }

    if (!await this.verifyTelegramHash(data)) {
      throw new UnauthorizedException('Недействительные данные аутентификации');
    }
  }

  private async verifyTelegramHash(data: TelegramLoginDto): Promise<boolean> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('Не настроен TELEGRAM_BOT_TOKEN');
    }

    const secretKey = createHash('sha256')
      .update(botToken)
      .digest();

    const checkString = Object.entries(data)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const hash = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    return data.hash === hash;
  }

  private isAuthExpired(authDate: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (now - authDate) > this.AUTH_EXPIRATION_TIME;
  }

  private async generateTokens(userId: string, telegramId: string, role: UserRole) {
    const payload = {
      sub: userId,
      telegramId,
      role
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        { expiresIn: '1h' }
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        { 
          expiresIn: '30d',
          secret: this.configService.get<string>('JWT_REFRESH_SECRET')
        }
      )
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUserData(user: any) {
    const { id, telegramId, username, firstName, lastName } = user;
    return { id, telegramId, username, firstName, lastName };
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')
      });

      return this.generateTokens(decoded.sub, decoded.telegramId, decoded.role);
    } catch (error) {
      throw new UnauthorizedException('Недействительный refresh token');
    }
  }
}