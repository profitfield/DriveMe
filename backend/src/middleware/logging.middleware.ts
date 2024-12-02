// src/middleware/logging.middleware.ts

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const requestStart = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const requestDuration = Date.now() - requestStart;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength}b ${requestDuration}ms - ${userAgent} ${ip}`
      );

      // Дополнительное логирование для ошибок
      if (statusCode >= 400) {
        this.logger.warn(
          `Request failed: ${method} ${originalUrl} ${statusCode} - ${ip}`
        );
      }
    });

    next();
  }
}