import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis(configService.get('REDIS_URL'));
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, seconds?: number): Promise<void> {
    if (seconds) {
      await this.redis.setex(key, seconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // Методы для работы со списками
  async lpush(key: string, value: string): Promise<number> {
    return this.redis.lpush(key, value);
  }

  async rpush(key: string, value: string): Promise<number> {
    return this.redis.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.redis.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    return this.redis.rpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.lrange(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.redis.ltrim(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this.redis.llen(key);
  }

  // Методы для работы с хешами
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.redis.hdel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  // Методы для работы с сетами
  async sadd(key: string, member: string): Promise<number> {
    return this.redis.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<number> {
    return this.redis.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.redis.sismember(key, member);
  }
}