// src/app.module.ts

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// Конфигурация
import { databaseConfig } from './config/database.config';
import { validate } from './config/validation/env.validation';
import { JwtConfigService } from './config/jwt.config';

// Сущности
import { User } from './entities/user.entity';
import { Driver } from './entities/driver.entity';
import { Order } from './entities/order.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Transaction } from './entities/transaction.entity';

// Модули
import { AuthModule } from './modules/auth.module';
import { UsersModule } from './modules/users.module';
import { DriversModule } from './modules/drivers.module';
import { OrdersModule } from './modules/orders.module';
import { AssignmentModule } from './modules/assignment/assignment.module';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';

// Filters
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Module({
  imports: [
    // Конфигурация приложения с валидацией
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      cache: true,
    }),

    // База данных с асинхронной конфигурацией
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<TypeOrmModuleOptions> => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User, Driver, Order, ChatMessage, Transaction],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development'
      }),
      inject: [ConfigService],
    }),

    // JWT с асинхронной конфигурацией
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h') 
        }
      }),
      inject: [ConfigService],
    }),

    // Модули приложения
    AuthModule,
    UsersModule,
    DriversModule,
    OrdersModule,
    AssignmentModule
  ],
  providers: [
    // JWT конфигурация
    JwtConfigService,
    
    // Глобальные guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },

    // Глобальный фильтр исключений
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