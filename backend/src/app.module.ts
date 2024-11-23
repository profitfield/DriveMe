import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

// Конфигурация
import { databaseConfig } from './config/database.config';

// Сущности
import { User } from './entities/user.entity';
import { Driver } from './entities/driver.entity';
import { Order } from './entities/order.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AdminLog } from './entities/admin-log.entity';
import { AdminSettings } from './entities/admin-settings.entity';

// Модули
import { UsersModule } from './modules/users.module';
import { DriversModule } from './modules/drivers.module';
import { OrdersModule } from './modules/orders.module';
import { AdminModule } from './modules/admin.module';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';

// Стратегии
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // Конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // База данных
    TypeOrmModule.forRoot(databaseConfig),

    // Аутентификация
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get('JWT_EXPIRES_IN', '30d')
        },
      }),
      inject: [ConfigService],
    }),

    // Функциональные модули
    UsersModule,
    DriversModule,
    OrdersModule,
    AdminModule
  ],
  providers: [
    // JWT стратегия
    JwtStrategy,

    // Глобальные guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: AdminRolesGuard
    }
  ],
  exports: [
    PassportModule,
    JwtModule
  ]
})
export class AppModule {}