import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { IncomingHttpHeaders } from 'http';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { RedisService } from './redis.service';
import { ContentValidationService, ContentType } from './content-validation.service';

export interface APISecurityConfig {
  rateLimits: {
    windowMs: number;
    maxRequests: number;
  };
  maxBodySize: number;
  maxQueryLength: number;
  maxHeaderSize: number;
  allowedMethods: string[];
  allowedHeaders: string[];
  allowedContentTypes: string[];
  sensitiveHeaders: string[];
}

@Injectable()
export class APISecurityService implements NestMiddleware {
  private readonly config: APISecurityConfig;

  constructor(
    private configService: ConfigService,
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private redisService: RedisService,
    private contentValidation: ContentValidationService
  ) {
    this.config = {
      rateLimits: {
        windowMs: configService.get('API_RATE_LIMIT_WINDOW_MS', 60000),
        maxRequests: configService.get('API_RATE_LIMIT_MAX_REQUESTS', 100)
      },
      maxBodySize: configService.get('API_MAX_BODY_SIZE', 1024 * 1024), // 1MB
      maxQueryLength: configService.get('API_MAX_QUERY_LENGTH', 1024),
      maxHeaderSize: configService.get('API_MAX_HEADER_SIZE', 8192),
      allowedMethods: configService.get('API_ALLOWED_METHODS', 'GET,POST,PUT,DELETE,PATCH').split(','),
      allowedHeaders: configService.get('API_ALLOWED_HEADERS', 'Content-Type,Authorization').split(','),
      allowedContentTypes: configService.get('API_ALLOWED_CONTENT_TYPES', 'application/json').split(','),
      sensitiveHeaders: configService.get('API_SENSITIVE_HEADERS', 'Authorization,Cookie').split(',')
    };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Проверка метода
      if (!this.config.allowedMethods.includes(req.method)) {
        throw new Error('Method not allowed');
      }

      // Проверка Content-Type
      const contentType = req.get('content-type');
      if (contentType && !this.config.allowedContentTypes.includes(contentType.split(';')[0])) {
        throw new Error('Content type not allowed');
      }

      // Проверка размера тела запроса
      if (req.body && JSON.stringify(req.body).length > this.config.maxBodySize) {
        throw new Error('Request body too large');
      }

      // Проверка длины query string
      if (req.url.length > this.config.maxQueryLength) {
        throw new Error('Query string too long');
      }

      // Проверка размера заголовков
      const headerSize = JSON.stringify(req.headers).length;
      if (headerSize > this.config.maxHeaderSize) {
        throw new Error('Headers too large');
      }

      // Проверка вредоносных заголовков
      if (this.hasMaliciousHeaders(req.headers)) {
        throw new Error('Malicious headers detected');
      }

      // Rate limiting
      await this.checkRateLimit(req);

      // Валидация и санитизация параметров
      await this.validateAndSanitizeRequest(req);

      // Логирование успешной проверки
      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.INFO,
        {
          resourceType: 'api',
          metadata: {
            method: req.method,
            path: req.path,
            ip: req.ip
          }
        }
      );

      next();
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'API security check failed',
        metadata: {
          error: error.message,
          method: req.method,
          path: req.path,
          ip: req.ip
        }
      });

      res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }
  }

  private hasMaliciousHeaders(headers: IncomingHttpHeaders): boolean {
    const maliciousPatterns = [
      /[<>]|javascript:|data:|vbscript:/i,
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      /(\%3C)|(\%3E)|(\%20)/i
    ];

    return Object.entries(headers).some(([key, value]) => {
      // Проверяем ключ всегда как строку
      if (maliciousPatterns.some(pattern => pattern.test(key))) {
        return true;
      }

      // Для значения проверяем как строку или массив строк
      if (value) {
        if (Array.isArray(value)) {
          return value.some(v => maliciousPatterns.some(pattern => pattern.test(v)));
        } else {
          return maliciousPatterns.some(pattern => pattern.test(value));
        }
      }

      return false;
    });
  }

  private async checkRateLimit(req: Request): Promise<void> {
    const key = `ratelimit:${req.ip}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      await this.redisService.expire(key, this.config.rateLimits.windowMs / 1000);
    }

    if (count > this.config.rateLimits.maxRequests) {
      throw new Error('Rate limit exceeded');
    }
  }

  private async validateAndSanitizeRequest(req: Request): Promise<void> {
    // Валидация query параметров
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          const { isValid } = this.contentValidation.validateAndSanitize(
            value,
            ContentType.TEXT
          );

          if (!isValid) {
            throw new Error(`Invalid query parameter: ${key}`);
          }
        }
      }
    }

    // Валидация тела запроса
    if (req.body) {
      this.validateRequestBody(req.body);
    }

    // Валидация заголовков
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && !this.config.sensitiveHeaders.includes(key)) {
        const { isValid } = this.contentValidation.validateAndSanitize(
          value,
          ContentType.TEXT
        );

        if (!isValid) {
          throw new Error(`Invalid header: ${key}`);
        }
      }
    }
  }

  private validateRequestBody(body: any, depth: number = 0): void {
    // Защита от слишком глубокой вложенности
    if (depth > 5) {
      throw new Error('Request body too deeply nested');
    }

    if (Array.isArray(body)) {
      // Защита от слишком больших массивов
      if (body.length > 1000) {
        throw new Error('Array in request body too large');
      }

      body.forEach(item => this.validateRequestBody(item, depth + 1));
    } else if (typeof body === 'object' && body !== null) {
      for (const [key, value] of Object.entries(body)) {
        // Валидация ключей
        const { isValid: keyValid } = this.contentValidation.validateAndSanitize(
          key,
          ContentType.TEXT
        );

        if (!keyValid) {
          throw new Error(`Invalid property name in request body: ${key}`);
        }

        // Рекурсивная валидация значений
        this.validateRequestBody(value, depth + 1);
      }
    } else if (typeof body === 'string') {
      const { isValid } = this.contentValidation.validateAndSanitize(
        body,
        ContentType.TEXT
      );

      if (!isValid) {
        throw new Error('Invalid string value in request body');
      }
    }
  }
}