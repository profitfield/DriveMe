// src/modules/websocket/websocket.module.ts

import { Module } from '@nestjs/common';
import { OrderGateway } from '../../gateways/order.gateway';
import { AuthModule } from '../auth.module';
import { WebSocketAuthGuard } from '../../guards/websocket-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h') 
        }
      }),
      inject: [ConfigService],
    })
  ],
  providers: [
    OrderGateway,
    WebSocketAuthGuard
  ],
  exports: [OrderGateway]
})
export class WebSocketModule {}