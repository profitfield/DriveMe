import { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfig: JwtModuleOptions = {
  secret: process.env.JWT_SECRET,
  signOptions: {
    expiresIn: '1h', // access token живет 1 час
  },
};

export const jwtRefreshConfig: JwtModuleOptions = {
  secret: process.env.JWT_REFRESH_SECRET,
  signOptions: {
    expiresIn: '7d', // refresh token живет 7 дней
  },
};

export interface JwtPayload {
  sub: string;
  telegramId: string;
  role: string;
  type: 'access' | 'refresh';
}