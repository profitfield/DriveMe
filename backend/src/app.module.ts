// src/app.module.ts

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

// Конфигурация
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';

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

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({ jwt: jwtConfig })]
    }),

    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([
      User,
      Driver,
      Order,
      ChatMessage,
      Transaction
    ]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' }
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    DriversModule,
    OrdersModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
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