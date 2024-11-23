import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controllers
import { AdminAuthController } from '../controllers/admin-auth.controller';
import { AdminController } from '../controllers/admin.controller';

// Services
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminService } from '../services/admin.service';

// Entities
import { AdminUser } from '../entities/admin-user.entity';
import { AdminLog } from '../entities/admin-log.entity';
import { AdminSettings } from '../entities/admin-settings.entity';
import { Order } from '../entities/order.entity';
import { Driver } from '../entities/driver.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      AdminLog,
      AdminSettings,
      Order,
      Driver,
      User
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get('JWT_EXPIRES_IN', '24h') 
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminController
  ],
  providers: [
    AdminAuthService,
    AdminService
  ],
  exports: [
    AdminService,
    AdminAuthService
  ]
})
export class AdminModule {}