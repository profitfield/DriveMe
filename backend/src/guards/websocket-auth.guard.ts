import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
    data: {
        user?: {
            userId: string;
            telegramId: string;
            role: string;
        };
    };
}

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            const client: AuthenticatedSocket = context.switchToWs().getClient();
            const token = this.extractTokenFromHeader(client);

            if (!token) {
                throw new WsException('Отсутствует токен авторизации');
            }

            try {
                const payload = await this.jwtService.verifyAsync(token, {
                    secret: this.configService.get<string>('JWT_SECRET')
                });
                
                // Сохраняем данные пользователя в объекте сокета
                client.data.user = {
                    userId: payload.sub,
                    telegramId: payload.telegramId,
                    role: payload.role
                };
                
                return true;
            } catch (error) {
                throw new WsException('Токен авторизации недействителен');
            }
        } catch (err) {
            throw new WsException('Ошибка авторизации: ' + err.message);
        }
    }

    private extractTokenFromHeader(client: Socket): string | undefined {
        // Проверяем сначала в auth
        if (client.handshake.auth && client.handshake.auth.token) {
            return client.handshake.auth.token;
        }

        // Затем проверяем в headers
        const authHeader = client.handshake.headers.authorization;
        if (!authHeader) {
            return undefined;
        }

        const [type, token] = authHeader.split(' ');
        if (type !== 'Bearer') {
            return undefined;
        }

        return token;
    }
}