import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SecurityLogger } from './logger.service';
import { ConfigService } from '@nestjs/config';
import { AuditLog } from '../entities/audit-log.entity';

export enum AuditActionType {
  // Аутентификация
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  TOKEN_REFRESH = 'token_refresh',

  // Пользователи
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',

  // Заказы
  ORDER_CREATE = 'order_create',
  ORDER_UPDATE = 'order_update',
  ORDER_CANCEL = 'order_cancel',
  ORDER_COMPLETE = 'order_complete',
  
  // Водители
  DRIVER_CREATE = 'driver_create',
  DRIVER_UPDATE = 'driver_update',
  DRIVER_STATUS = 'driver_status',
  DRIVER_LOCATION = 'driver_location',

  // Финансы
  PAYMENT_PROCESS = 'payment_process',
  COMMISSION_CHARGE = 'commission_charge',
  BONUS_CREDIT = 'bonus_credit',
  REFUND = 'refund',

  // Администрирование
  SETTINGS_CHANGE = 'settings_change',
  ROLE_CHANGE = 'role_change',
  SYSTEM_CONFIG = 'system_config',

  // Безопасность
  SECURITY_VIOLATION = 'security_violation',
  ACCESS_DENIED = 'access_denied',
  DATA_EXPORT = 'data_export',

  // WebSocket события
  WS_CONNECTION_OPENED = 'ws_connection_opened',
  WS_CONNECTION_CLOSED = 'ws_connection_closed',
  WS_MESSAGE_SENT = 'ws_message_sent',
  WS_ERROR = 'ws_error'
}

export enum AuditLogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private securityLogger: SecurityLogger,
    private configService: ConfigService
  ) {}

  /**
   * Логирование действия
   */
  async log(
    actionType: AuditActionType,
    level: AuditLogLevel,
    details: {
      userId?: string;
      userType?: 'client' | 'driver' | 'admin';
      resourceId?: string;
      resourceType?: string;
      oldValue?: any;
      newValue?: any;
      metadata?: Record<string, any>;
      ip?: string;
      userAgent?: string;
      status?: 'success' | 'failure';
      errorDetails?: string;
    }
  ): Promise<void> {
    try {
      const entry = this.auditLogRepository.create({
        id: this.generateLogId(),
        timestamp: new Date(),
        actionType,
        level,
        ...details,
        status: details.status || 'success'
      });

      // Сохраняем в БД
      await this.auditLogRepository.save(entry);

      // Для критических событий дополнительно логируем через SecurityLogger
      if (level === AuditLogLevel.CRITICAL || level === AuditLogLevel.ERROR) {
        this.securityLogger.logSecurityEvent({
          type: 'modification',
          severity: level === AuditLogLevel.CRITICAL ? 'critical' : 'high',
          message: `Audit: ${actionType}`,
          userId: details.userId,
          metadata: {
            ...details.metadata,
            resourceId: details.resourceId,
            resourceType: details.resourceType
          }
        });
      }

      // Отправляем уведомление для критических событий
      if (level === AuditLogLevel.CRITICAL) {
        await this.notifySecurityTeam(entry);
      }
    } catch (error) {
      // В случае ошибки логирования записываем через SecurityLogger
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'critical',
        message: 'Failed to create audit log',
        metadata: {
          actionType,
          error: error.message,
          details
        }
      });
    }
  }

  /**
   * Получение записей аудита
   */
  async getAuditLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    actionTypes?: AuditActionType[];
    levels?: AuditLogLevel[];
    userId?: string;
    resourceId?: string;
    resourceType?: string;
    status?: 'success' | 'failure';
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit')
      .orderBy('audit.timestamp', 'DESC');

    // Применяем фильтры
    if (filters.startDate) {
      query.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    }
    if (filters.actionTypes?.length) {
      query.andWhere('audit.actionType IN (:...actionTypes)', { actionTypes: filters.actionTypes });
    }
    if (filters.levels?.length) {
      query.andWhere('audit.level IN (:...levels)', { levels: filters.levels });
    }
    if (filters.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }
    if (filters.resourceId) {
      query.andWhere('audit.resourceId = :resourceId', { resourceId: filters.resourceId });
    }
    if (filters.resourceType) {
      query.andWhere('audit.resourceType = :resourceType', { resourceType: filters.resourceType });
    }
    if (filters.status) {
      query.andWhere('audit.status = :status', { status: filters.status });
    }

    // Пагинация
    if (filters.limit) {
      query.take(filters.limit);
    }
    if (filters.offset) {
      query.skip(filters.offset);
    }

    const [logs, total] = await query.getManyAndCount();
    return { logs, total };
  }

  /**
   * Получение статистики аудита
   */
  async getAuditStats(period: 'day' | 'week' | 'month'): Promise<{
    totalLogs: number;
    byLevel: Record<AuditLogLevel, number>;
    byAction: Record<AuditActionType, number>;
    failureRate: number;
  }> {
    const startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const logs = await this.auditLogRepository.find({
      where: {
        timestamp: MoreThan(startDate)
      }
    });

    const stats = {
      totalLogs: logs.length,
      byLevel: {} as Record<AuditLogLevel, number>,
      byAction: {} as Record<AuditActionType, number>,
      failureRate: 0
    };

    // Подсчитываем статистику
    logs.forEach(log => {
      // По уровням
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      // По типам действий
      stats.byAction[log.actionType] = (stats.byAction[log.actionType] || 0) + 1;
    });

    // Считаем процент ошибок
    const failures = logs.filter(log => log.status === 'failure').length;
    stats.failureRate = (failures / logs.length) * 100;

    return stats;
  }

  /**
   * Очистка старых логов
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .where('timestamp <= :cutoffDate', { cutoffDate })
        .execute();

      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'low',
        message: 'Old audit logs cleaned up',
        metadata: {
          retentionDays,
          cutoffDate
        }
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Failed to cleanup old audit logs',
        metadata: {
          error: error.message,
          retentionDays
        }
      });
    }
  }

  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async notifySecurityTeam(entry: AuditLog): Promise<void> {
    // TODO: Реализовать отправку уведомлений команде безопасности
    console.error('CRITICAL AUDIT EVENT:', entry);
  }
}