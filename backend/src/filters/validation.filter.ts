import { 
    ExceptionFilter, 
    Catch, 
    ArgumentsHost, 
    BadRequestException 
  } from '@nestjs/common';
  import { Response } from 'express';
  
  @Catch(BadRequestException)
  export class ValidationFilter implements ExceptionFilter {
    catch(exception: BadRequestException, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
  
      response
        .status(status)
        .json({
          statusCode: status,
          message: 'Validation failed',
          errors: Array.isArray(exceptionResponse.message) 
            ? exceptionResponse.message 
            : [exceptionResponse.message],
          timestamp: new Date().toISOString(),
        });
    }
  }