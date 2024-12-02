// src/filters/global-exception.filter.ts

import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
  import { AppException } from '../exceptions/base.exception';
  
  @Catch()
  export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);
  
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Internal server error';
      let errorCode = 'INTERNAL_ERROR';
  
      if (exception instanceof AppException) {
        const error = exception.getResponse() as any;
        status = error.status;
        message = error.message;
        errorCode = error.errorCode;
      } else if (exception instanceof HttpException) {
        status = exception.getStatus();
        message = exception.message;
      }
  
      // Логируем ошибку
      this.logger.error({
        path: request.url,
        method: request.method,
        status,
        message,
        errorCode,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      });
  
      response.status(status).json({
        statusCode: status,
        message,
        errorCode,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }