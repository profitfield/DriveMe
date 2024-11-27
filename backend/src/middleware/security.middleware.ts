import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import * as xss from 'xss';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly xssOptions = {
    whiteList: {}, // Пустой список разрешенных тегов
    stripIgnoreTag: true, // Удалять теги не из белого списка
    stripIgnoreTagBody: ['script'], // Удалять содержимое script тегов
  };

  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return xss.filterXSS(data, this.xssOptions);
    }
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      for (const key in data) {
        sanitized[key] = this.sanitizeData(data[key]);
      }
      return sanitized;
    }
    return data;
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Применяем Helmet с настройками безопасности
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })(req, res, () => {});

    // Санитизация входных данных
    if (req.body) {
      req.body = this.sanitizeData(req.body);
    }
    if (req.query) {
      req.query = this.sanitizeData(req.query);
    }
    if (req.params) {
      req.params = this.sanitizeData(req.params);
    }

    next();
  }
}