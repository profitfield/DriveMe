import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityLogger implements LoggerService {
  private logger: Logger;
  private securityLogger: Logger;

  constructor(private configService: ConfigService) {
    // Основной логгер для обычных событий
    this.logger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d'
        })
      ]
    });

    // Отдельный логгер для событий безопасности
    this.securityLogger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d'
        })
      ]
    });

    // Добавляем вывод в консоль для разработки
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      }));
    }
  }

  // Логирование событий безопасности
  logSecurityEvent(event: {
    type: 'auth' | 'access' | 'modification' | 'attack' | 'error';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metadata?: any;
    userId?: string;
    ip?: string;
  }) {
    this.securityLogger.warn({
      timestamp: new Date().toISOString(),
      ...event,
      environment: process.env.NODE_ENV
    });

    // Для критических событий отправляем уведомление
    if (event.severity === 'critical') {
      this.notifySecurityTeam(event);
    }
  }

  // Логирование попыток атак
  logSecurityViolation(violation: {
    type: string;
    description: string;
    ip: string;
    headers?: any;
    payload?: any;
  }) {
    this.securityLogger.error({
      timestamp: new Date().toISOString(),
      event: 'security_violation',
      ...violation,
      environment: process.env.NODE_ENV
    });
  }

  // Логирование активности пользователей
  logUserActivity(activity: {
    userId: string;
    action: string;
    resource: string;
    metadata?: any;
    ip?: string;
  }) {
    this.logger.info({
      timestamp: new Date().toISOString(),
      event: 'user_activity',
      ...activity,
      environment: process.env.NODE_ENV
    });
  }

  private async notifySecurityTeam(event: any) {
    // TODO: Реализовать отправку уведомлений команде безопасности
    // Например, через email, Slack или другие каналы
    console.error('CRITICAL SECURITY EVENT:', event);
  }

  // Имплементация LoggerService
  log(message: string, context?: string) {
    this.logger.info({ message, context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error({ message, trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn({ message, context });
  }

  debug(message: string, context?: string) {
    this.logger.debug({ message, context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose({ message, context });
  }
}