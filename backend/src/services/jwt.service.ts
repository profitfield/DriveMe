// src/services/jwt.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  telegramId: string;
  role: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtService {
  private refreshTokens: Map<string, string> = new Map();

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService
  ) {}

  async generateTokens(
    userId: string, 
    telegramId: string, 
    role: string
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, telegramId, role),
      this.generateRefreshToken(userId, telegramId, role)
    ]);

    // Сохраняем refresh token
    this.refreshTokens.set(userId, refreshToken);

    return {
      accessToken,
      refreshToken
    };
  }

  private async generateAccessToken(
    userId: string,
    telegramId: string,
    role: string
  ): Promise<string> {
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

  private async generateRefreshToken(
    userId: string,
    telegramId: string,
    role: string
  ): Promise<string> {
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

      // Для refresh токена проверяем наличие в хранилище
      if (type === 'refresh') {
        const storedToken = this.refreshTokens.get(payload.sub);
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
    this.refreshTokens.delete(payload.sub);

    return newTokens;
  }

  async invalidateTokens(userId: string) {
    this.refreshTokens.delete(userId);
  }
}