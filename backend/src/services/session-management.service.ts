import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { Session } from '../entities/session.entity';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  userId: string;
  userType: 'client' | 'driver' | 'admin';
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    deviceId?: string;
  };
  lastActivity?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class SessionManagementService {
  private readonly sessionPrefix = 'session:';
  private readonly devicePrefix = 'device:';
  private readonly maxActiveSessions = 5;
  private readonly sessionTTL = 24 * 60 * 60; // 24 часа

  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private redisService: RedisService,
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private configService: ConfigService
  ) {}

  /**
   * Создание новой сессии
   */
  async createSession(sessionData: SessionData): Promise<string> {
    try {
      // Генерируем ID сессии
      const sessionId = uuidv4();

      // Проверяем количество активных сессий
      await this.checkActiveSessions(sessionData.userId);

      // Создаем запись в БД
      const session = await this.sessionRepository.save({
        id: sessionId,
        userId: sessionData.userId,
        userType: sessionData.userType,
        deviceInfo: sessionData.deviceInfo,
        metadata: sessionData.metadata,
        lastActivity: new Date(),
        isActive: true
      });

      // Сохраняем в Redis для быстрого доступа
      await this.saveSessionToRedis(sessionId, session);

      // Привязываем устройство к пользователю
      if (sessionData.deviceInfo?.deviceId) {
        await this.linkDeviceToUser(
          sessionData.userId,
          sessionData.deviceInfo.deviceId,
          sessionId
        );
      }

      // Логируем создание сессии
      await this.auditService.log(
        AuditActionType.LOGIN,
        AuditLogLevel.INFO,
        {
          userId: sessionData.userId,
          metadata: {
            sessionId,
            deviceInfo: sessionData.deviceInfo
          }
        }
      );

      return sessionId;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'auth',
        severity: 'high',
        message: 'Failed to create session',
        userId: sessionData.userId,
        metadata: {
          error: error.message,
          deviceInfo: sessionData.deviceInfo
        }
      });
      throw error;
    }
  }

  /**
   * Валидация сессии
   */
  async validateSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      // Сначала проверяем в Redis
      const cachedSession = await this.getSessionFromRedis(sessionId);
      
      if (cachedSession && cachedSession.userId === userId && cachedSession.isActive) {
        // Обновляем время последней активности
        await this.updateLastActivity(sessionId);
        return true;
      }

      // Если нет в кэше, проверяем в БД
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId, userId }
      });

      if (session?.isActive) {
        // Обновляем кэш и время последней активности
        await this.saveSessionToRedis(sessionId, session);
        await this.updateLastActivity(sessionId);
        return true;
      }

      return false;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'auth',
        severity: 'medium',
        message: 'Session validation failed',
        userId,
        metadata: {
          sessionId,
          error: error.message
        }
      });
      return false;
    }
  }

  /**
   * Завершение сессии
   */
  async terminateSession(sessionId: string, userId: string): Promise<void> {
    try {
      // Деактивируем сессию в БД
      await this.sessionRepository.update(
        { id: sessionId, userId },
        { 
          isActive: false,
          terminatedAt: new Date()
        }
      );

      // Удаляем из Redis
      await this.redisService.del(`${this.sessionPrefix}${sessionId}`);

      // Логируем завершение сессии
      await this.auditService.log(
        AuditActionType.LOGOUT,
        AuditLogLevel.INFO,
        {
          userId,
          metadata: { sessionId }
        }
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'auth',
        severity: 'medium',
        message: 'Failed to terminate session',
        userId,
        metadata: {
          sessionId,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Завершение всех сессий пользователя
   */
  async terminateAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    try {
      // Получаем все активные сессии
      const sessions = await this.sessionRepository.find({
        where: { userId, isActive: true }
      });

      // Завершаем каждую сессию
      for (const session of sessions) {
        if (session.id !== exceptSessionId) {
          await this.terminateSession(session.id, userId);
        }
      }

      // Логируем действие
      await this.auditService.log(
        AuditActionType.LOGOUT,
        AuditLogLevel.WARNING,
        {
          userId,
          metadata: {
            action: 'terminate_all_sessions',
            exceptSessionId
          }
        }
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'auth',
        severity: 'high',
        message: 'Failed to terminate all sessions',
        userId,
        metadata: { error: error.message }
      });
      throw error;
    }
  }

  private async saveSessionToRedis(sessionId: string, session: Session): Promise<void> {
    const key = `${this.sessionPrefix}${sessionId}`;
    await this.redisService.set(
      key,
      JSON.stringify(session),
      this.sessionTTL
    );
  }

  private async getSessionFromRedis(sessionId: string): Promise<Session | null> {
    const key = `${this.sessionPrefix}${sessionId}`;
    const data = await this.redisService.get(key);
    return data ? JSON.parse(data) : null;
  }

  private async updateLastActivity(sessionId: string): Promise<void> {
    const now = new Date();
    
    // Обновляем в БД
    await this.sessionRepository.update(
      { id: sessionId },
      { lastActivity: now }
    );

    // Обновляем в Redis
    const session = await this.getSessionFromRedis(sessionId);
    if (session) {
      session.lastActivity = now;
      await this.saveSessionToRedis(sessionId, session);
    }
  }

  private async checkActiveSessions(userId: string): Promise<void> {
    const activeSessions = await this.sessionRepository.count({
      where: { userId, isActive: true }
    });

    if (activeSessions >= this.maxActiveSessions) {
      // Завершаем самую старую сессию
      const oldestSession = await this.sessionRepository.findOne({
        where: { userId, isActive: true },
        order: { lastActivity: 'ASC' }
      });

      if (oldestSession) {
        await this.terminateSession(oldestSession.id, userId);
      }
    }
  }

  private async linkDeviceToUser(
    userId: string,
    deviceId: string,
    sessionId: string
  ): Promise<void> {
    const key = `${this.devicePrefix}${userId}:${deviceId}`;
    await this.redisService.set(key, sessionId);
  }
}