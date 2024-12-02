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
  private tokenStorage: Map<string, string> = new Map();

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

    this.tokenStorage.set(userId, refreshToken);

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

      if (payload.type !== type) {
        throw new UnauthorizedException('Invalid token type');
      }

      if (type === 'refresh') {
        const storedToken = this.tokenStorage.get(payload.sub);
        if (!storedToken || storedToken !== token) {
          throw new UnauthorizedException('Refresh token is invalid or expired');
        }
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async updateTokens(refreshToken: string) {
    const payload = await this.verifyToken(refreshToken, 'refresh');
    
    const newTokens = await this.generateTokens(
      payload.sub,
      payload.telegramId,
      payload.role
    );

    this.tokenStorage.delete(payload.sub);

    return newTokens;
  }

  async invalidateUserTokens(userId: string) {
    this.tokenStorage.delete(userId);
  }
}