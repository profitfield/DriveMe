// src/guards/websocket-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from '../services/auth.service';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromHeader(client);

      if (!token) {
        throw new WsException('Отсутствует токен авторизации');
      }

      const payload = await this.authService.validateToken(token);
      
      // Сохраняем данные пользователя в объекте сокета
      client.data.user = payload;
      
      return true;
    } catch (err) {
      throw new WsException('Неверный токен авторизации');
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const auth = client.handshake.auth.token || 
                 client.handshake.headers.authorization;
    
    if (!auth) {
      return undefined;
    }

    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}