import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BruteforceProtectionService } from '../services/bruteforce-protection.service';

export const BRUTEFORCE_TYPE_KEY = 'bruteforceType';
export const BruteforceProtection = (type: string) => SetMetadata(BRUTEFORCE_TYPE_KEY, type);

@Injectable()
export class BruteforceGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private bruteforceProtection: BruteforceProtectionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const type = this.reflector.get<string>(BRUTEFORCE_TYPE_KEY, context.getHandler()) || 'api';

    // Определяем ключ для проверки (IP или ID пользователя)
    const key = this.getKeyFromRequest(request);

    // Проверяем блокировку
    if (await this.bruteforceProtection.isBlocked(key, type)) {
      const remainingTime = await this.bruteforceProtection.getBlockTimeRemaining(key, type);
      
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many attempts, please try again later',
        remainingTime
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Записываем попытку
    const canProceed = await this.bruteforceProtection.recordAttempt(key, type);
    
    if (!canProceed) {
      const remainingTime = await this.bruteforceProtection.getBlockTimeRemaining(key, type);
      
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many attempts, please try again later',
        remainingTime
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private getKeyFromRequest(request: any): string {
    // Если есть авторизованный пользователь, используем его ID
    if (request.user?.id) {
      return request.user.id;
    }
    
    // Иначе используем IP адрес
    return request.ip;
  }
}