import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

@Injectable()
export class JwtConfigService {
  constructor(private configService: ConfigService) {
    // Проверяем наличие необходимых переменных при инициализации
    this.validateConfig();
  }

  private validateConfig() {
    const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EXPIRES_IN'];
    const missing = requiredEnvVars.filter(
      env => !this.configService.get(env)
    );

    if (missing.length > 0) {
      throw new Error(`Missing required JWT configuration: ${missing.join(', ')}`);
    }
  }

  createJwtOptions(): JwtModuleOptions {
    return {
      secret: this.getJwtSecret(),
      signOptions: {
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      },
    };
  }

  createRefreshOptions(): JwtSignOptions {
    return {
      secret: this.getRefreshSecret(),
      expiresIn: '7d',
    };
  }

  getJwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    return secret;
  }

  getRefreshSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }
    return secret;
  }
}