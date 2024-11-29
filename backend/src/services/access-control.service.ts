import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { RedisService } from './redis.service';

interface AccessRule {
  resource: string;
  action: string;
  roles?: string[];
  attributes?: Record<string, any>;
  conditions?: (context: AccessContext) => boolean;
}

interface AccessContext {
  userId: string;
  userRole: string;
  userAttributes?: Record<string, any>;
  resourceId?: string;
  resourceAttributes?: Record<string, any>;
  timestamp?: Date;
  ip?: string;
}

@Injectable()
export class AccessControlService {
  private rules: Map<string, AccessRule[]> = new Map();
  private roleHierarchy: Map<string, string[]> = new Map();

  constructor(
    private configService: ConfigService,
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private redisService: RedisService
  ) {
    this.initializeRoleHierarchy();
    this.initializeDefaultRules();
  }

  /**
   * Проверка прав доступа
   */
  async checkAccess(
    context: AccessContext,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      // Кэшированная проверка
      const cached = await this.getCachedPermission(
        context.userId,
        resource,
        action
      );
      
      if (cached !== null) {
        return cached === 'true';
      }

      // Получение правил для ресурса
      const resourceRules = this.rules.get(resource) || [];
      
      // Проверка каждого правила
      for (const rule of resourceRules) {
        if (await this.matchRule(rule, context, action)) {
          await this.cachePermission(context.userId, resource, action, true);
          return true;
        }
      }

      // Логируем отказ в доступе
      await this.logAccessDenial(context, resource, action);
      
      await this.cachePermission(context.userId, resource, action, false);
      return false;

    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'high',
        message: 'Access control check failed',
        userId: context.userId,
        metadata: {
          resource,
          action,
          error: error.message
        }
      });
      return false;
    }
  }

  /**
   * Добавление правила доступа
   */
  addRule(rule: AccessRule): void {
    const resourceRules = this.rules.get(rule.resource) || [];
    resourceRules.push(rule);
    this.rules.set(rule.resource, resourceRules);

    // Инвалидируем кэш для этого ресурса
    this.invalidateResourceCache(rule.resource);
  }

  /**
   * Обновление иерархии ролей
   */
  updateRoleHierarchy(role: string, inherits: string[]): void {
    this.roleHierarchy.set(role, inherits);
    // Инвалидируем весь кэш прав доступа
    this.invalidateAllCache();
  }

  private async matchRule(
    rule: AccessRule,
    context: AccessContext,
    action: string
  ): Promise<boolean> {
    // Проверка действия
    if (rule.action !== action && rule.action !== '*') {
      return false;
    }

    // Проверка роли
    if (rule.roles && !this.checkRole(context.userRole, rule.roles)) {
      return false;
    }

    // Проверка атрибутов
    if (rule.attributes && !this.checkAttributes(rule.attributes, context)) {
      return false;
    }

    // Проверка условий
    if (rule.conditions && !rule.conditions(context)) {
      return false;
    }

    return true;
  }

  private checkRole(userRole: string, allowedRoles: string[]): boolean {
    // Проверяем саму роль
    if (allowedRoles.includes(userRole)) {
      return true;
    }

    // Проверяем иерархию ролей
    const inheritedRoles = this.roleHierarchy.get(userRole) || [];
    return inheritedRoles.some(role => allowedRoles.includes(role));
  }

  private checkAttributes(
    ruleAttributes: Record<string, any>,
    context: AccessContext
  ): boolean {
    for (const [key, value] of Object.entries(ruleAttributes)) {
      const userValue = context.userAttributes?.[key];
      if (userValue !== value) {
        return false;
      }
    }
    return true;
  }

  private async getCachedPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<string | null> {
    const key = `acl:${userId}:${resource}:${action}`;
    return this.redisService.get(key);
  }

  private async cachePermission(
    userId: string,
    resource: string,
    action: string,
    allowed: boolean
  ): Promise<void> {
    const key = `acl:${userId}:${resource}:${action}`;
    // Сохраняем ключ в множество для этого ресурса
    const cacheKeysSet = `acl:keys:${resource}`;
    await this.redisService.sadd(cacheKeysSet, key);
    // Сохраняем само разрешение
    await this.redisService.set(key, allowed.toString(), 3600);
  }

  private async invalidateResourceCache(resource: string): Promise<void> {
    // Сохраняем список ключей для ресурса в отдельном множестве
    const cacheKeysSet = `acl:keys:${resource}`;
    const keys = await this.redisService.smembers(cacheKeysSet);
    
    // Удаляем все ключи
    for (const key of keys) {
      await this.redisService.del(key);
    }
    
    // Очищаем множество
    await this.redisService.del(cacheKeysSet);
  }

  private async invalidateAllCache(): Promise<void> {
    // Получаем список всех ресурсов
    const resources = Array.from(this.rules.keys());
    
    // Инвалидируем кэш для каждого ресурса
    for (const resource of resources) {
      await this.invalidateResourceCache(resource);
    }
  }

  private async logAccessDenial(
    context: AccessContext,
    resource: string,
    action: string
  ): Promise<void> {
    await this.auditService.log(
      AuditActionType.ACCESS_DENIED,
      AuditLogLevel.WARNING,
      {
        userId: context.userId,
        metadata: {
          resource,
          action,
          userRole: context.userRole,
          resourceId: context.resourceId,
          timestamp: new Date(),
          ip: context.ip
        }
      }
    );
  }

  private initializeRoleHierarchy(): void {
    this.roleHierarchy.set('super_admin', ['admin', 'operator', 'driver', 'client']);
    this.roleHierarchy.set('admin', ['operator', 'driver', 'client']);
    this.roleHierarchy.set('operator', ['client']);
  }

  private initializeDefaultRules(): void {
    // Правила для заказов
    this.addRule({
      resource: 'orders',
      action: 'create',
      roles: ['client'],
      conditions: (ctx) => ctx.userAttributes?.isBlocked !== true
    });

    // Правила для водителей
    this.addRule({
      resource: 'drivers',
      action: 'update_status',
      roles: ['driver'],
      conditions: (ctx) => ctx.userAttributes?.isVerified === true
    });

    // Правила для админов
    this.addRule({
      resource: 'admin_settings',
      action: '*',
      roles: ['super_admin']
    });
  }
}