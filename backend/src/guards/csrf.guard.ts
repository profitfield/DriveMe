import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfService } from '../services/csrf.service';

export const SkipCsrf = () => Reflector.createDecorator<boolean>();

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private csrfService: CsrfService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Проверяем наличие декоратора @SkipCsrf()
    const skipCsrf = this.reflector.get<boolean>(
      SkipCsrf,
      context.getHandler()
    );

    if (skipCsrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Пропускаем GET запросы
    if (request.method === 'GET') {
      return true;
    }

    const sessionId = request.user?.id;
    const csrfToken = request.headers['x-csrf-token'];

    if (!sessionId || !csrfToken) {
      return false;
    }

    return this.csrfService.validateToken(sessionId, csrfToken);
  }
}