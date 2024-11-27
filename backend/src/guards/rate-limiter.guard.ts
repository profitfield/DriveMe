import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../services/redis.service';

export interface RateLimitOptions {
  points: number;      // Количество разрешенных запросов
  duration: number;    // Период в секундах
  keyPrefix?: string;  // Префикс для ключа Redis
}

export const RateLimit = (options: RateLimitOptions) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('rateLimit', options, target, propertyKey);
  };
};

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>('rateLimit', context.getHandler());
    
    if (!rateLimitOptions) {
      return true; // Если ограничений нет, пропускаем
    }

    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip;
    const path = request.route.path;
    
    const key = `ratelimit:${rateLimitOptions.keyPrefix || path}:${clientIp}`;
    
    const current = await this.redisService.incr(key);
    
    if (current === 1) {
      await this.redisService.expire(key, rateLimitOptions.duration);
    }

    if (current > rateLimitOptions.points) {
      const ttl = await this.redisService.ttl(key);
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Rate limit exceeded',
        retryAfter: ttl
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}