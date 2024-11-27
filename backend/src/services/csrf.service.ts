import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from './redis.service';
import { SecurityLogger } from './logger.service';

@Injectable()
export class CsrfService {
  private readonly tokenLength: number = 32;
  private readonly tokenExpiration: number = 3600; // 1 час

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly securityLogger: SecurityLogger
  ) {}

  /**
   * Генерация CSRF токена
   */
  async generateToken(sessionId: string): Promise<string> {
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    const key = this.getRedisKey(sessionId);
    
    // Сохраняем токен в Redis
    await this.redisService.set(
      key,
      token,
      this.tokenExpiration
    );

    // Создаем двойной хеш для отправки клиенту
    const clientToken = this.createClientToken(token);

    this.securityLogger.logSecurityEvent({
      type: 'access',
      severity: 'low',
      message: 'CSRF token generated',
      metadata: { sessionId }
    });

    return clientToken;
  }

  /**
   * Валидация CSRF токена
   */
  async validateToken(sessionId: string, clientToken: string): Promise<boolean> {
    try {
      const key = this.getRedisKey(sessionId);
      const storedToken = await this.redisService.get(key);

      if (!storedToken) {
        this.securityLogger.logSecurityEvent({
          type: 'access',
          severity: 'medium',
          message: 'CSRF token not found',
          metadata: { sessionId }
        });
        return false;
      }

      // Проверяем соответствие токенов
      const isValid = this.verifyClientToken(clientToken, storedToken);

      if (!isValid) {
        this.securityLogger.logSecurityEvent({
          type: 'attack',
          severity: 'high',
          message: 'Invalid CSRF token',
          metadata: { sessionId }
        });
      }

      return isValid;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'attack', // Изменено с 'error' на 'attack'
        severity: 'high',
        message: 'CSRF validation error',
        metadata: { sessionId, error: error.message }
      });
      return false;
    }
  }

  /**
   * Инвалидация CSRF токена
   */
  async invalidateToken(sessionId: string): Promise<void> {
    const key = this.getRedisKey(sessionId);
    await this.redisService.del(key);
  }

  /**
   * Создание double-submit cookie
   */
  createCsrfCookie(token: string): string {
    return `XSRF-TOKEN=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`;
  }

  private getRedisKey(sessionId: string): string {
    return `csrf:${sessionId}`;
  }

  private createClientToken(token: string): string {
    const secret = this.configService.get<string>('CSRF_SECRET');
    return crypto
      .createHmac('sha256', secret)
      .update(token)
      .digest('hex');
  }

  private verifyClientToken(clientToken: string, storedToken: string): boolean {
    const expectedToken = this.createClientToken(storedToken);
    return crypto.timingSafeEqual(
      Buffer.from(clientToken),
      Buffer.from(expectedToken)
    );
  }
}