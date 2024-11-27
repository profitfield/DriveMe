import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CsrfService } from '../services/csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly csrfService: CsrfService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Пропускаем GET запросы и запросы без авторизации
    if (req.method === 'GET' || !req.headers.authorization) {
      return next();
    }

    const sessionId = this.extractSessionId(req);
    const csrfToken = this.extractCsrfToken(req);

    if (!sessionId || !csrfToken) {
      throw new UnauthorizedException('CSRF token is required');
    }

    const isValid = await this.csrfService.validateToken(sessionId, csrfToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid CSRF token');
    }

    // Генерируем новый токен после успешной валидации
    const newToken = await this.csrfService.generateToken(sessionId);
    res.setHeader('X-CSRF-Token', newToken);

    next();
  }

  private extractSessionId(req: Request): string | null {
    // Извлекаем ID сессии из JWT токена или cookie
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    try {
      // Простое извлечение ID из Bearer токена
      // В реальном приложении здесь должна быть правильная JWT валидация
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      return payload.sub;
    } catch {
      return null;
    }
  }

  private extractCsrfToken(req: Request): string | null {
    // Проверяем токен в заголовке
    const headerToken = req.headers['x-csrf-token'];
    if (headerToken) {
      return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }

    // Проверяем токен в теле запроса
    const bodyToken = req.body?._csrf;
    if (bodyToken) {
      return bodyToken;
    }

    return null;
  }
}