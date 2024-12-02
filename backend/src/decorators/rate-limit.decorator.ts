// src/decorators/rate-limit.decorator.ts

import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  points: number;      // Number of allowed requests
  duration: number;    // Period in seconds
  keyPrefix: string;   // Prefix for Redis key
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);