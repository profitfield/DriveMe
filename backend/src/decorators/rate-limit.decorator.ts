import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  points: number;      // Количество разрешенных запросов
  duration: number;    // Период в секундах
  keyPrefix: string;   // Префикс для ключа Redis
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);