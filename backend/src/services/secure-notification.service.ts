import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { EncryptionService } from './encryption.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { RedisService } from './redis.service';
import { Notification } from '../entities/notification.entity';

export enum NotificationType {
  // Системные
  SECURITY_ALERT = 'security_alert',
  SYSTEM_UPDATE = 'system_update',
  MAINTENANCE = 'maintenance',

  // Аутентификация
  LOGIN_ATTEMPT = 'login_attempt',
  PASSWORD_CHANGE = 'password_change',
  NEW_DEVICE = 'new_device',

  // Заказы
  ORDER_CREATED = 'order_created',
  ORDER_ACCEPTED = 'order_accepted',
  ORDER_STARTED = 'order_started',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',

  // Водители
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ARRIVED = 'driver_arrived',
  DRIVER_LOCATION = 'driver_location',

  // Финансы
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  BONUS_CREDITED = 'bonus_credited',
  COMMISSION_CHARGED = 'commission_charged'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class SecureNotificationService {
  private readonly defaultTTL = 7 * 24 * 60 * 60; // 7 дней
  private readonly rateLimit = {
    perUser: 50,     // максимум 50 уведомлений
    timeWindow: 3600  // в час
  };

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private securityLogger: SecurityLogger,
    private encryptionService: EncryptionService,
    private auditService: AuditService,
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  /**
   * Отправка уведомления
   */
  async send(
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
    options: {
      priority?: NotificationPriority;
      ttl?: number;
      channels?: ('telegram' | 'push' | 'email')[];
    } = {}
  ): Promise<void> {
    try {
      // Проверяем rate limit
      if (!await this.checkRateLimit(userId)) {
        throw new Error('Notification rate limit exceeded');
      }

      // Получаем шаблон и готовим уведомление
      const template = this.getTemplate(type);
      const notification = this.prepareNotification(template, data);

      // Шифруем чувствительные данные
      const encryptedData = await this.encryptSensitiveData(notification);

      // Сохраняем уведомление
      const savedNotification = await this.saveNotification(
        userId,
        type,
        encryptedData,
        options
      );

      // Отправляем по выбранным каналам
      await this.deliverNotification(
        savedNotification,
        options.channels || ['telegram']
      );

      // Логируем успешную отправку
      await this.auditService.log(
        AuditActionType.SYSTEM_CONFIG,
        AuditLogLevel.INFO,
        {
          userId,
          resourceType: 'notification',
          resourceId: savedNotification.id,
          metadata: {
            type,
            channels: options.channels,
            priority: options.priority
          }
        }
      );
    } catch (error) {
      // Логируем ошибку
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'Failed to send notification',
        userId,
        metadata: {
          type,
          error: error.message
        }
      });

      throw error;
    }
  }

  /**
   * Получение уведомлений пользователя
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      types?: NotificationType[];
      unreadOnly?: boolean;
    } = {}
  ): Promise<any[]> {
    try {
      const query = this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId })
        .orderBy('notification.createdAt', 'DESC');

      if (options.types?.length) {
        query.andWhere('notification.type IN (:...types)', { types: options.types });
      }

      if (options.unreadOnly) {
        query.andWhere('notification.readAt IS NULL');
      }

      if (options.limit) {
        query.take(options.limit);
      }

      if (options.offset) {
        query.skip(options.offset);
      }

      const notifications = await query.getMany();

      // Расшифровываем данные
      return await Promise.all(
        notifications.map(async n => ({
          ...n,
          data: await this.decryptSensitiveData(n.data)
        }))
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'medium',
        message: 'Failed to get user notifications',
        userId,
        metadata: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Отметка уведомления как прочитанного
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await this.notificationRepository.update(
        { id: notificationId, userId },
        { readAt: new Date() }
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'low',
        message: 'Failed to mark notification as read',
        userId,
        metadata: {
          notificationId,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Удаление уведомлений пользователя
   */
  async deleteUserNotifications(
    userId: string,
    options: {
      notificationIds?: string[];
      olderThan?: Date;
    } = {}
  ): Promise<void> {
    try {
      const query = this.notificationRepository
        .createQueryBuilder()
        .delete()
        .where('userId = :userId', { userId });

      if (options.notificationIds?.length) {
        query.andWhere('id IN (:...ids)', { ids: options.notificationIds });
      }

      if (options.olderThan) {
        query.andWhere('createdAt < :date', { date: options.olderThan });
      }

      await query.execute();

      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.INFO,
        {
          userId,
          resourceType: 'notification',
          metadata: {
            notificationIds: options.notificationIds,
            olderThan: options.olderThan
          }
        }
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'Failed to delete notifications',
        userId,
        metadata: {
          options,
          error: error.message
        }
      });
      throw error;
    }
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
    const key = `notifications:ratelimit:${userId}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      await this.redisService.expire(key, this.rateLimit.timeWindow);
    }

    return count <= this.rateLimit.perUser;
  }

  private getTemplate(type: NotificationType): NotificationTemplate {
    // TODO: Загружать шаблоны из базы данных или конфигурации
    return {
      title: 'Notification',
      body: 'You have a new notification',
      data: {}
    };
  }

  private prepareNotification(
    template: NotificationTemplate,
    data: Record<string, any>
  ): Record<string, any> {
    // Заменяем плейсхолдеры в шаблоне
    let body = template.body;
    for (const [key, value] of Object.entries(data)) {
      body = body.replace(`{{${key}}}`, String(value));
    }

    return {
      ...template,
      body,
      data
    };
  }

  private async encryptSensitiveData(data: Record<string, any>): Promise<string> {
    return this.encryptionService.encrypt(JSON.stringify(data));
  }

  private async decryptSensitiveData(encryptedData: string): Promise<Record<string, any>> {
    const decrypted = await this.encryptionService.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }

  private async saveNotification(
    userId: string,
    type: NotificationType,
    encryptedData: string,
    options: {
      priority?: NotificationPriority;
      ttl?: number;
    }
  ): Promise<any> {
    const notification = await this.notificationRepository.save({
      userId,
      type,
      data: encryptedData,
      priority: options.priority || NotificationPriority.LOW,
      ttl: options.ttl || this.defaultTTL,
      createdAt: new Date()
    });

    // Сохраняем в кэш для быстрого доступа
    const cacheKey = `notifications:${userId}:${notification.id}`;
    await this.redisService.set(
      cacheKey,
      JSON.stringify(notification),
      options.ttl || this.defaultTTL
    );

    return notification;
  }

  private async deliverNotification(
    notification: any,
    channels: ('telegram' | 'push' | 'email')[]
  ): Promise<void> {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'telegram':
            // await this.sendTelegramNotification(notification);
            break;
          case 'push':
            // await this.sendPushNotification(notification);
            break;
          case 'email':
            // await this.sendEmailNotification(notification);
            break;
        }
      } catch (error) {
        this.securityLogger.logSecurityEvent({
          type: 'modification',
          severity: 'medium',
          message: `Failed to deliver notification via ${channel}`,
          userId: notification.userId,
          metadata: {
            notificationId: notification.id,
            error: error.message
          }
        });
      }
    }
  }
}