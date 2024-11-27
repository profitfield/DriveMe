import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import * as sanitizeHtml from 'sanitize-html';
import { FilterXSS } from 'xss';
import * as validator from 'validator';

export enum ContentType {
  TEXT = 'text',
  HTML = 'html',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
  USERNAME = 'username',
  PASSWORD = 'password',
  JSON = 'json',
  FILE_NAME = 'file_name'
}

export interface ValidationOptions {
  maxLength?: number;
  minLength?: number;
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
  allowedPatterns?: RegExp[];
  disallowedPatterns?: RegExp[];
  customValidators?: ((content: string) => boolean)[];
}

@Injectable()
export class ContentValidationService {
  private readonly xssFilter: FilterXSS;

  private readonly defaultOptions: Record<ContentType, ValidationOptions> = {
    [ContentType.TEXT]: {
      maxLength: 5000,
      minLength: 1,
      disallowedPatterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /data:/gi,
        /vbscript:/gi
      ]
    },
    [ContentType.HTML]: {
      maxLength: 10000,
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li',
        'strong', 'em', 'i', 'b', 'a', 'img', 'blockquote', 'code'
      ],
      allowedAttributes: {
        a: ['href', 'title', 'target'],
        img: ['src', 'alt', 'title', 'width', 'height']
      }
    },
    [ContentType.URL]: {
      maxLength: 2048,
      customValidators: [
        (url) => validator.isURL(url, {
          protocols: ['http', 'https'],
          require_protocol: true
        })
      ]
    },
    [ContentType.EMAIL]: {
      maxLength: 254,
      customValidators: [
        (email) => validator.isEmail(email)
      ]
    },
    [ContentType.PHONE]: {
      maxLength: 15,
      minLength: 10,
      customValidators: [
        (phone) => validator.isMobilePhone(phone, 'any')
      ]
    },
    [ContentType.USERNAME]: {
      maxLength: 30,
      minLength: 3,
      allowedPatterns: [/^[a-zA-Z0-9_-]+$/]
    },
    [ContentType.PASSWORD]: {
      minLength: 8,
      customValidators: [
        (password) => validator.isStrongPassword(password, {
          minLength: 8,
          minLowercase: 1,
          minUppercase: 1,
          minNumbers: 1,
          minSymbols: 1
        })
      ]
    },
    [ContentType.JSON]: {
      maxLength: 50000,
      customValidators: [
        (json) => {
          try {
            JSON.parse(json);
            return true;
          } catch {
            return false;
          }
        }
      ]
    },
    [ContentType.FILE_NAME]: {
      maxLength: 255,
      allowedPatterns: [/^[a-zA-Z0-9_\-\. ]+$/]
    }
  };

  constructor(
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private configService: ConfigService
  ) {
    this.xssFilter = new FilterXSS({
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    });
  }

  /**
   * Валидация контента
   */
  validate(
    content: string,
    type: ContentType,
    customOptions?: ValidationOptions
  ): boolean {
    try {
      const options = {
        ...this.defaultOptions[type],
        ...customOptions
      };

      // Проверка длины
      if (options.maxLength && content.length > options.maxLength) {
        return false;
      }
      if (options.minLength && content.length < options.minLength) {
        return false;
      }

      // Проверка разрешенных паттернов
      if (options.allowedPatterns) {
        if (!options.allowedPatterns.some(pattern => pattern.test(content))) {
          return false;
        }
      }

      // Проверка запрещенных паттернов
      if (options.disallowedPatterns) {
        if (options.disallowedPatterns.some(pattern => pattern.test(content))) {
          return false;
        }
      }

      // Выполнение пользовательских валидаторов
      if (options.customValidators) {
        if (!options.customValidators.every(validator => validator(content))) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'Content validation failed',
        metadata: {
          contentType: type,
          error: error.message
        }
      });
      return false;
    }
  }

  /**
   * Санитизация контента
   */
  sanitize(
    content: string,
    type: ContentType,
    customOptions?: ValidationOptions
  ): string {
    try {
      const options = {
        ...this.defaultOptions[type],
        ...customOptions
      };

      let sanitized = content;

      switch (type) {
        case ContentType.HTML:
          sanitized = sanitizeHtml(content, {
            allowedTags: options.allowedTags,
            allowedAttributes: options.allowedAttributes
          });
          break;

        case ContentType.TEXT:
          sanitized = this.xssFilter.process(content);
          break;

        case ContentType.URL:
          if (validator.isURL(content)) {
            try {
              const url = new URL(content);
              sanitized = url.toString();
            } catch {
              sanitized = '';
            }
          }
          break;

        case ContentType.EMAIL:
          sanitized = validator.normalizeEmail(content) || content;
          break;

        case ContentType.PHONE:
          sanitized = content.replace(/[^\d+]/g, '');
          if (!sanitized.startsWith('+')) {
            sanitized = '+' + sanitized;
          }
          break;

        case ContentType.USERNAME:
          sanitized = content.replace(/[^a-zA-Z0-9_-]/g, '');
          break;

        case ContentType.FILE_NAME:
          sanitized = content.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
          break;

        case ContentType.JSON:
          try {
            const parsed = JSON.parse(content);
            sanitized = JSON.stringify(parsed);
          } catch {
            sanitized = '{}';
          }
          break;
      }

      // Обрезаем по максимальной длине
      if (options.maxLength) {
        sanitized = sanitized.slice(0, options.maxLength);
      }

      // Если контент был изменен, логируем это
      if (sanitized !== content) {
        this.auditService.log(
          AuditActionType.DATA_EXPORT,
          AuditLogLevel.INFO,
          {
            resourceType: 'content',
            metadata: {
              type,
              action: 'sanitize'
            }
          }
        );
      }

      return sanitized;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'Content sanitization failed',
        metadata: {
          contentType: type,
          error: error.message
        }
      });
      return '';
    }
  }

  /**
   * Проверка и санитизация контента
   */
  validateAndSanitize(
    content: string,
    type: ContentType,
    customOptions?: ValidationOptions
  ): { isValid: boolean; sanitized: string } {
    const sanitized = this.sanitize(content, type, customOptions);
    const isValid = this.validate(sanitized, type, customOptions);

    return { isValid, sanitized };
  }

  /**
   * Проверка и санитизация объекта
   */
  validateAndSanitizeObject<T extends Record<string, any>>(
    object: T,
    schema: Record<keyof T, ContentType>,
    options?: Record<keyof T, ValidationOptions>
  ): { isValid: boolean; sanitized: Partial<T>; errors: Partial<Record<keyof T, string>> } {
    const result = {
      isValid: true,
      sanitized: {} as Partial<T>,
      errors: {} as Partial<Record<keyof T, string>>
    };

    for (const [key, value] of Object.entries(object)) {
      if (typeof value !== 'string') {
        result.isValid = false;
        result.errors[key as keyof T] = 'Value must be a string';
        continue;
      }

      const type = schema[key as keyof T];
      const customOptions = options?.[key as keyof T];

      const { isValid, sanitized } = this.validateAndSanitize(
        value,
        type,
        customOptions
      );

      result.sanitized[key as keyof T] = sanitized as T[keyof T];

      if (!isValid) {
        result.isValid = false;
        result.errors[key as keyof T] = `Invalid ${type}`;
      }
    }

    return result;
  }
}