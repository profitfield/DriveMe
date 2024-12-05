// backend/src/app.module.ts

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

// Configuration
import { validate } from './config/validation/env.validation';
import { JwtConfigService } from './config/jwt.config';
import { CacheConfigService } from './config/cache.config';

// Entities
import { User } from './entities/user.entity';
import { Driver } from './entities/driver.entity';
import { Order } from './entities/order.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Transaction } from './entities/transaction.entity';

// Modules
import { AuthModule } from './modules/auth.module';
import { UsersModule } from './modules/users.module';
import { DriversModule } from './modules/drivers.module';
import { OrdersModule } from './modules/orders.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { TelegramModule } from './modules/telegram.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { NotificationModule } from './modules/notification.module';

// Controllers
import { PriceController } from './controllers/price.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';

// Filters
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Module({
    imports: [
        // Application configuration
        ConfigModule.forRoot({
            isGlobal: true,
            validate,
            cache: true,
        }),

        // Cache configuration
        CacheModule.registerAsync({
            isGlobal: true,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                ttl: configService.get('CACHE_TTL', 300),
                max: configService.get('CACHE_MAX_ITEMS', 1000),
                isGlobal: true
            })
        }),

        // Database configuration
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get<string>('DB_HOST'),
                port: configService.get<number>('DB_PORT'),
                username: configService.get<string>('DB_USER'),
                password: configService.get<string>('DB_PASSWORD'),
                database: configService.get<string>('DB_NAME'),
                entities: [User, Driver, Order, ChatMessage, Transaction],
                synchronize: false,
                logging: configService.get<string>('NODE_ENV') === 'development'
            })
        }),

        // Feature modules
        AuthModule,
        UsersModule,
        DriversModule,
        OrdersModule,
        AssignmentModule,
        TelegramModule,
        WebSocketModule,
        NotificationModule
    ],
    controllers: [
        PriceController
    ],
    providers: [
        // Configuration services
        JwtConfigService,
        CacheConfigService,

        // Global guards
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RateLimiterGuard,
        },

        // Global exception filter
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        }
    ]
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(LoggingMiddleware)
            .forRoutes('*');
    }
}