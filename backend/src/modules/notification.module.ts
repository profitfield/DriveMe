// backend/src/modules/notification.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationQueueService } from '../services/notification-queue.service';
import { NotificationProcessor } from '../processors/notification.processor';
import { TelegramModule } from './telegram.module';

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST'),
                    port: configService.get('REDIS_PORT'),
                    password: configService.get('REDIS_PASSWORD'),
                },
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({
            name: 'notifications',
        }),
        TelegramModule
    ],
    providers: [
        NotificationQueueService,
        NotificationProcessor
    ],
    exports: [NotificationQueueService]
})
export class NotificationModule {}