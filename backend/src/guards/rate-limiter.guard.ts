// src/guards/rate-limiter.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { rateLimitConfig } from '../config/rate-limit.config';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Упрощенная реализация для MVP
    // TODO: Добавить полноценный rate limiting с использованием Redis
    return true;
  }
}