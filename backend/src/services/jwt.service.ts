import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtService {
  constructor(
    private jwtService: NestJwtService,
    private configService: ConfigService
  ) {}

  async generateToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      telegramId: user.telegramId,
      role: 'client' // По умолчанию клиент, для водителей будем отдельно проверять
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '30d'
    });
  }

  async verifyToken(token: string): Promise<any> {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_SECRET')
    });
  }
}