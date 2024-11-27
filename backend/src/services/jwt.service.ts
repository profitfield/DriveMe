import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../config/jwt.config';
import { RedisService } from './redis.service';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async generateTokens(userId: string, telegramId: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, telegramId, role),
      this.generateRefreshToken(userId, telegramId, role)
    ]);

    // Сохраняем refresh token в Redis
    const refreshTokenKey = `refresh_token:${userId}`;
    await this.redisService.set(
      refreshTokenKey,
      refreshToken,
      60 * 60 * 24 * 7 // 7 дней
    );

    return {
      accessToken,
      refreshToken
    };
  }

  private async generateAccessToken(userId: string, telegramId: string, role: string): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      telegramId,
      role,
      type: 'access'
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '1h'
    });
  }

  private async generateRefreshToken(userId: string, telegramId: string, role: string): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      telegramId,
      role,
      type: 'refresh'
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d'
    });
  }

  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<JwtPayload> {
    try {
      const secret = this.configService.get(
        type === 'access' ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET'
      );

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret
      });

      // Проверяем тип токена
      if (payload.type !== type) {
        throw new UnauthorizedException('Invalid token type');
      }

      // Для refresh токена проверяем наличие в Redis
      if (type === 'refresh') {
        const storedToken = await this.redisService.get(`refresh_token:${payload.sub}`);
        if (!storedToken || storedToken !== token) {
          throw new UnauthorizedException('Refresh token is invalid or expired');
        }
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshTokens(refreshToken: string) {
    // Проверяем refresh token
    const payload = await this.verifyToken(refreshToken, 'refresh');
    
    // Генерируем новую пару токенов
    const newTokens = await this.generateTokens(
      payload.sub,
      payload.telegramId,
      payload.role
    );

    // Инвалидируем старый refresh token
    await this.redisService.del(`refresh_token:${payload.sub}`);

    return newTokens;
  }

  async invalidateTokens(userId: string) {
    // Удаляем refresh token из Redis
    await this.redisService.del(`refresh_token:${userId}`);
  }
}