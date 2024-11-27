import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { RedisService } from './redis.service';
import { SuspiciousActivity } from '../entities/suspicious-activity.entity';

export enum ActivityType {
  // Аутентификация
  FAILED_LOGIN = 'failed_login',
  UNUSUAL_LOGIN_TIME = 'unusual_login_time',
  UNUSUAL_LOGIN_LOCATION = 'unusual_login_location',
  MULTIPLE_DEVICES = 'multiple_devices',
  CONCURRENT_SESSIONS = 'concurrent_sessions',

  // Запросы
  ABNORMAL_REQUEST_RATE = 'abnormal_request_rate',
  SUSPICIOUS_REQUEST_PATTERN = 'suspicious_request_pattern',
  INVALID_PARAMETERS = 'invalid_parameters',
  MALFORMED_PAYLOAD = 'malformed_payload',

  // Данные
  DATA_LEAKAGE_ATTEMPT = 'data_leakage_attempt',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  MASS_DATA_ACCESS = 'mass_data_access',

  // Финансы
  UNUSUAL_TRANSACTION = 'unusual_transaction',
  HIGH_VALUE_TRANSACTION = 'high_value_transaction',
  RAPID_TRANSACTIONS = 'rapid_transactions',
  REJECTED_PAYMENT = 'rejected_payment',

  // Поведение
  BOT_BEHAVIOR = 'bot_behavior',
  SCRAPING_ATTEMPT = 'scraping_attempt',
  SPAM_ACTIVITY = 'spam_activity',
  ABNORMAL_NAVIGATION = 'abnormal_navigation'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ActionTaken {
  NONE = 'none',
  MONITOR = 'monitor',
  WARN = 'warn',
  BLOCK = 'block',
  SUSPEND = 'suspend',
  NOTIFY_ADMIN = 'notify_admin'
}

interface ActivityContext {
  userId?: string;
  userType?: 'client' | 'driver' | 'admin';
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class SuspiciousActivityService {
  private readonly activityThresholds = new Map<ActivityType, number>([
    [ActivityType.FAILED_LOGIN, 5],
    [ActivityType.ABNORMAL_REQUEST_RATE, 100],
    [ActivityType.MASS_DATA_ACCESS, 1000],
    [ActivityType.RAPID_TRANSACTIONS, 10],
    [ActivityType.UNUSUAL_LOGIN_TIME, 3],
    [ActivityType.UNUSUAL_LOGIN_LOCATION, 2],
    [ActivityType.MULTIPLE_DEVICES, 5],
    [ActivityType.CONCURRENT_SESSIONS, 3],
    [ActivityType.SUSPICIOUS_REQUEST_PATTERN, 20],
    [ActivityType.INVALID_PARAMETERS, 50],
    [ActivityType.MALFORMED_PAYLOAD, 10],
    [ActivityType.DATA_LEAKAGE_ATTEMPT, 1],
    [ActivityType.UNAUTHORIZED_ACCESS, 3],
    [ActivityType.SENSITIVE_DATA_ACCESS, 5],
    [ActivityType.UNUSUAL_TRANSACTION, 3],
    [ActivityType.HIGH_VALUE_TRANSACTION, 2],
    [ActivityType.BOT_BEHAVIOR, 100],
    [ActivityType.SCRAPING_ATTEMPT, 50],
    [ActivityType.SPAM_ACTIVITY, 20],
    [ActivityType.ABNORMAL_NAVIGATION, 30]
  ]);

  constructor(
    @InjectRepository(SuspiciousActivity)
    private suspiciousActivityRepository: Repository<SuspiciousActivity>,
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  /**
   * Регистрация подозрительной активности
   */
  async logActivity(
    type: ActivityType,
    context: ActivityContext,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const riskLevel = await this.assessRisk(type, context);

      const activity = this.suspiciousActivityRepository.create({
        type,
        riskLevel,
        ...context,
        details,
        actionTaken: await this.determineAction(type, riskLevel, context),
        createdAt: new Date()
      });

      await this.suspiciousActivityRepository.save(activity);

      // Проверяем, нужно ли предпринимать действия
      await this.handleSuspiciousActivity(activity);

      // Логируем в системе аудита
      await this.auditService.log(
        AuditActionType.SECURITY_VIOLATION,
        this.mapRiskLevelToAuditLevel(riskLevel),
        {
          userId: context.userId,
          metadata: {
            activityType: type,
            riskLevel,
            ip: context.ip,
            details
          }
        }
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Failed to log suspicious activity',
        userId: context.userId,
        metadata: {
          type,
          error: error.message
        }
      });
    }
  }

  /**
   * Проверка активности пользователя
   */
  async checkUserActivity(
    userId: string,
    activityType: ActivityType
  ): Promise<boolean> {
    const key = `activity:${userId}:${activityType}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      await this.redisService.expire(key, 3600); // 1 час
    }

    const threshold = this.activityThresholds[activityType] || 10;
    return count <= threshold;
  }

  /**
   * Анализ подозрительной активности
   */
  async analyzeActivity(filters: {
    userId?: string;
    type?: ActivityType[];
    riskLevel?: RiskLevel[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    activities: SuspiciousActivity[];
    total: number;
    riskSummary: Record<RiskLevel, number>;
  }> {
    const query = this.suspiciousActivityRepository.createQueryBuilder('activity');

    if (filters.userId) {
      query.andWhere('activity.userId = :userId', { userId: filters.userId });
    }

    if (filters.type?.length) {
      query.andWhere('activity.type IN (:...types)', { types: filters.type });
    }

    if (filters.riskLevel?.length) {
      query.andWhere('activity.riskLevel IN (:...levels)', { levels: filters.riskLevel });
    }

    if (filters.startDate) {
      query.andWhere('activity.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('activity.createdAt <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('activity.createdAt', 'DESC');

    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    const [activities, total] = await query.getManyAndCount();

    // Считаем статистику по уровням риска
    const riskSummary: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0
    };

    activities.forEach(activity => {
      riskSummary[activity.riskLevel]++;
    });

    return { activities, total, riskSummary };
  }

  private async assessRisk(
    type: ActivityType,
    context: ActivityContext
  ): Promise<RiskLevel> {
    // Базовый уровень риска для каждого типа активности
    const baseRisk = this.getBaseRiskLevel(type);

    // Факторы, повышающие уровень риска
    const riskFactors = await this.calculateRiskFactors(type, context);

    // Вычисляем итоговый уровень риска
    return this.calculateFinalRiskLevel(baseRisk, riskFactors);
  }

  private getBaseRiskLevel(type: ActivityType): RiskLevel {
    const riskMap = new Map<ActivityType, RiskLevel>([
      [ActivityType.FAILED_LOGIN, RiskLevel.MEDIUM],
      [ActivityType.UNUSUAL_LOGIN_LOCATION, RiskLevel.HIGH],
      [ActivityType.DATA_LEAKAGE_ATTEMPT, RiskLevel.CRITICAL],
      [ActivityType.UNAUTHORIZED_ACCESS, RiskLevel.HIGH],
      [ActivityType.UNUSUAL_LOGIN_TIME, RiskLevel.MEDIUM],
      [ActivityType.MULTIPLE_DEVICES, RiskLevel.MEDIUM],
      [ActivityType.CONCURRENT_SESSIONS, RiskLevel.HIGH],
      [ActivityType.ABNORMAL_REQUEST_RATE, RiskLevel.HIGH],
      [ActivityType.SUSPICIOUS_REQUEST_PATTERN, RiskLevel.HIGH],
      [ActivityType.INVALID_PARAMETERS, RiskLevel.MEDIUM],
      [ActivityType.MALFORMED_PAYLOAD, RiskLevel.HIGH],
      [ActivityType.SENSITIVE_DATA_ACCESS, RiskLevel.HIGH],
      [ActivityType.MASS_DATA_ACCESS, RiskLevel.HIGH],
      [ActivityType.UNUSUAL_TRANSACTION, RiskLevel.HIGH],
      [ActivityType.HIGH_VALUE_TRANSACTION, RiskLevel.HIGH],
      [ActivityType.RAPID_TRANSACTIONS, RiskLevel.MEDIUM],
      [ActivityType.REJECTED_PAYMENT, RiskLevel.MEDIUM],
      [ActivityType.BOT_BEHAVIOR, RiskLevel.HIGH],
      [ActivityType.SCRAPING_ATTEMPT, RiskLevel.HIGH],
      [ActivityType.SPAM_ACTIVITY, RiskLevel.MEDIUM],
      [ActivityType.ABNORMAL_NAVIGATION, RiskLevel.LOW]
    ]);

    return riskMap.get(type) || RiskLevel.LOW;
  }

  private async calculateRiskFactors(
    type: ActivityType,
    context: ActivityContext
  ): Promise<number> {
    let riskScore = 0;

    // Проверяем историю активности
    const recentActivities = await this.getRecentActivities(
      context.userId,
      type
    );
    riskScore += recentActivities.length;

    // Проверяем необычное время
    if (this.isUnusualTime()) {
      riskScore += 1;
    }

    // Проверяем геолокацию
    if (context.ip && await this.isUnusualLocation(context.ip, context.userId)) {
      riskScore += 2;
    }

    return riskScore;
  }

  private calculateFinalRiskLevel(
    baseRisk: RiskLevel,
    riskFactors: number
  ): RiskLevel {
    const riskLevels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
    const baseIndex = riskLevels.indexOf(baseRisk);
    
    // Повышаем уровень риска на основе факторов
    const finalIndex = Math.min(
      baseIndex + Math.floor(riskFactors / 3),
      riskLevels.length - 1
    );

    return riskLevels[finalIndex];
  }

  private async determineAction(
    type: ActivityType,
    riskLevel: RiskLevel,
    context: ActivityContext
  ): Promise<ActionTaken> {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        await this.blockUser(context.userId);
        return ActionTaken.BLOCK;
      
      case RiskLevel.HIGH:
        if (this.isRepeatOffender(context.userId)) {
          await this.suspendUser(context.userId);
          return ActionTaken.SUSPEND;
        }
        return ActionTaken.WARN;
      
      case RiskLevel.MEDIUM:
        return ActionTaken.MONITOR;
      
      default:
        return ActionTaken.NONE;
    }
  }

  private async handleSuspiciousActivity(
    activity: SuspiciousActivity
  ): Promise<void> {
    switch (activity.actionTaken) {
      case ActionTaken.BLOCK:
        await this.notifySecurityTeam(activity);
        break;
      
      case ActionTaken.SUSPEND:
        await this.notifyUser(activity);
        break;
      
      case ActionTaken.WARN:
        await this.addToWatchlist(activity);
        break;
    }
  }

  private async getRecentActivities(
    userId: string,
    type: ActivityType
  ): Promise<SuspiciousActivity[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return this.suspiciousActivityRepository.find({
      where: {
        userId,
        type,
        createdAt: MoreThanOrEqual(oneHourAgo)
      }
    });
  }

  private isUnusualTime(): boolean {
    const hour = new Date().getHours();
    return hour >= 0 && hour <= 5; // Необычное время: 00:00 - 05:00
  }

  private async isUnusualLocation(ip: string, userId: string): Promise<boolean> {
    // TODO: Реализовать проверку геолокации
    return false;
  }

  private async isRepeatOffender(userId: string): Promise<boolean> {
    const key = `repeat_offender:${userId}`;
    const count = await this.redisService.get(key);
    return count && parseInt(count) > 3;
  }

  private async blockUser(userId: string): Promise<void> {
    // TODO: Реализовать блокировку пользователя
  }

  private async suspendUser(userId: string): Promise<void> {
    // TODO: Реализовать временную блокировку пользователя
  }

  private async notifySecurityTeam(activity: SuspiciousActivity): Promise<void> {
    // TODO: Реализовать уведомление команды безопасности
  }

  private async notifyUser(activity: SuspiciousActivity): Promise<void> {
    // TODO: Реализовать уведомление пользователя
  }

  private async addToWatchlist(activity: SuspiciousActivity): Promise<void> {
    const key = `watchlist:${activity.userId}`;
    await this.redisService.sadd(key, activity.id);
    await this.redisService.expire(key, 7 * 24 * 60 * 60); // 7 дней
  }

  private mapRiskLevelToAuditLevel(riskLevel: RiskLevel): AuditLogLevel {
    const mapping: Record<RiskLevel, AuditLogLevel> = {
      [RiskLevel.LOW]: AuditLogLevel.INFO,
      [RiskLevel.MEDIUM]: AuditLogLevel.WARNING,
      [RiskLevel.HIGH]: AuditLogLevel.ERROR,
      [RiskLevel.CRITICAL]: AuditLogLevel.CRITICAL
    };
    return mapping[riskLevel];
  }
}