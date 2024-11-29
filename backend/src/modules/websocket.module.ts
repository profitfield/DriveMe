import { Module } from '@nestjs/common';
import { WebSocketGateway } from '../gateways/websocket.gateway';
import { WebSocketSecurityService } from '../services/websocket-security.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityModule } from './security.module';

@Module({
  imports: [
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
    SecurityModule
  ],
  providers: [
    WebSocketGateway,
    WebSocketSecurityService
  ],
  exports: [
    WebSocketSecurityService
  ]
})
export class WebSocketModule {}