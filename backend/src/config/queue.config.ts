// src/config/queue.config.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModuleOptions, SharedBullConfigurationFactory } from '@nestjs/bull';

@Injectable()
export class QueueConfigService implements SharedBullConfigurationFactory {
  constructor(private configService: ConfigService) {}

  createSharedConfiguration(): BullModuleOptions {
    return {
      redis: {
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get('REDIS_DB', 0),
      },
      prefix: this.configService.get('QUEUE_PREFIX', 'driveme'),
      defaultJobOptions: {
        attempts: this.configService.get('QUEUE_DEFAULT_ATTEMPTS', 3),
        timeout: this.configService.get('QUEUE_JOB_TIMEOUT', 30000),
        removeOnComplete: true,
        removeOnFail: false,
      },
    };
  }
}