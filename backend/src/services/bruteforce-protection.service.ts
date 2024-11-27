import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { SecurityLogger } from './logger.service';

export interface AttemptConfig {
  maxAttempts: number;      // Максимальное количество попыток
  blockDuration: number;    // Длительность блокировки в секундах
  windowSize: number;       // Размер окна для попыток в секундах
}

@Injectable()
export class BruteforceProtectionService {
  private readonly defaultConfig: AttemptConfig = {
    maxAttempts: 5,
    blockDuration: 1800,  // 30 минут
    windowSize: 300       // 5 минут
  };

  private readonly configMap: Record<string, AttemptConfig> = {
    auth: {
      maxAttempts: 5,
      blockDuration: 1800,
      windowSize: 300
    },
    adminAuth: {
      maxAttempts: 3,
      blockDuration: 3600,
      windowSize: 300
    },
    api: {
      maxAttempts: 100,
      blockDuration: 300,
      windowSize: 60
    }
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly securityLogger: SecurityLogger
  ) {}

  /**
   * Проверка на блокировку
   */
  async isBlocked(key: string, type: string = 'auth'): Promise<boolean> {
    const blockKey = this.getBlockKey(key, type);
    const isBlocked = await this.redisService.get(blockKey);
    
    if (isBlocked) {
      const ttl = await this.redisService.ttl(blockKey);
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'medium',
        message: `Access blocked for ${type}`,
        metadata: { key, remainingTime: ttl }
      });
      return true;
    }
    
    return false;
  }

  /**
   * Регистрация попытки доступа
   */
  async recordAttempt(
    key: string, 
    type: string = 'auth', 
    success: boolean = false
  ): Promise<boolean> {
    if (await this.isBlocked(key, type)) {
      return false;
    }

    const config = this.configMap[type] || this.defaultConfig;
    const attemptsKey = this.getAttemptsKey(key, type);

    if (success) {
      // При успешной попытке сбрасываем счетчик
      await this.redisService.del(attemptsKey);
      return true;
    }

    // Увеличиваем счетчик попыток
    const attempts = await this.redisService.incr(attemptsKey);
    
    // Устанавливаем TTL при первой попытке
    if (attempts === 1) {
      await this.redisService.expire(attemptsKey, config.windowSize);
    }

    // Проверяем превышение лимита попыток
    if (attempts >= config.maxAttempts) {
      await this.block(key, type);
      
      this.securityLogger.logSecurityEvent({
        type: 'attack',
        severity: 'high',
        message: `Too many failed attempts for ${type}`,
        metadata: {
          key,
          attempts,
          blockDuration: config.blockDuration
        }
      });
      
      return false;
    }

    // Логируем неудачную попытку
    if (!success) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'low',
        message: `Failed ${type} attempt`,
        metadata: {
          key,
          attemptNumber: attempts,
          maxAttempts: config.maxAttempts
        }
      });
    }

    return true;
  }

  /**
   * Блокировка ключа
   */
  private async block(key: string, type: string): Promise<void> {
    const config = this.configMap[type] || this.defaultConfig;
    const blockKey = this.getBlockKey(key, type);
    
    await this.redisService.set(
      blockKey,
      'blocked',
      config.blockDuration
    );
  }

  /**
   * Разблокировка ключа
   */
  async unblock(key: string, type: string = 'auth'): Promise<void> {
    const blockKey = this.getBlockKey(key, type);
    await this.redisService.del(blockKey);
    
    // Очищаем историю попыток
    const attemptsKey = this.getAttemptsKey(key, type);
    await this.redisService.del(attemptsKey);

    this.securityLogger.logSecurityEvent({
      type: 'modification',
      severity: 'medium',
      message: `Unblocked ${type}`,
      metadata: { key }
    });
  }

  /**
   * Получение оставшегося времени блокировки
   */
  async getBlockTimeRemaining(key: string, type: string = 'auth'): Promise<number> {
    const blockKey = this.getBlockKey(key, type);
    return this.redisService.ttl(blockKey);
  }

  /**
   * Получение количества оставшихся попыток
   */
  async getRemainingAttempts(key: string, type: string = 'auth'): Promise<number> {
    const config = this.configMap[type] || this.defaultConfig;
    const attemptsKey = this.getAttemptsKey(key, type);
    
    const attempts = await this.redisService.get(attemptsKey);
    return config.maxAttempts - (attempts ? parseInt(attempts, 10) : 0);
  }

  private getBlockKey(key: string, type: string): string {
    return `bruteforce:block:${type}:${key}`;
  }

  private getAttemptsKey(key: string, type: string): string {
    return `bruteforce:attempts:${type}:${key}`;
  }
}