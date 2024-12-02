// src/guards/rate-limiter.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimit = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler()
    );

    if (!rateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(rateLimit.keyPrefix, request);

    // For MVP, we'll implement a simple in-memory rate limiting
    // In production, this should use Redis or similar
    return true;
  }

  private generateKey(prefix: string, request: any): string {
    const userId = request.user?.id || 'anonymous';
    return `${prefix}:${userId}`;
  }
}