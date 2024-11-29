import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from '../services/access-control.service';
import { AuditService } from '../services/audit.service';

export const RequirePermission = (resource: string, action: string) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('resource', resource, descriptor.value);
    Reflect.defineMetadata('action', action, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private accessControlService: AccessControlService,
    private auditService: AuditService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>('resource', context.getHandler());
    const action = this.reflector.get<string>('action', context.getHandler());

    if (!resource || !action) {
      return true; // Если метаданные не определены, разрешаем доступ
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Собираем контекст доступа
    const accessContext = {
      userId: user.id,
      userRole: user.role,
      userAttributes: user.attributes || {},
      resourceId: request.params?.id,
      resourceAttributes: {},
      timestamp: new Date(),
      ip: request.ip
    };

    // Добавляем дополнительные атрибуты ресурса если они есть
    if (request.method === 'PUT' || request.method === 'POST') {
      accessContext.resourceAttributes = request.body;
    }

    // Проверяем доступ
    const hasAccess = await this.accessControlService.checkAccess(
      accessContext,
      resource,
      action
    );

    return hasAccess;
  }
}