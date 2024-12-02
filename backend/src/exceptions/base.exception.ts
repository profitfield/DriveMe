// src/exceptions/base.exception.ts

import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super(
      {
        message,
        errorCode,
        status,
        timestamp: new Date().toISOString(),
      },
      status
    );
  }
}

export class EntityNotFoundException extends AppException {
  constructor(entity: string, id: string) {
    super(
      `${entity} with id ${id} not found`,
      'ENTITY_NOT_FOUND',
      HttpStatus.NOT_FOUND
    );
  }
}

export class ValidationException extends AppException {
  constructor(errors: string[]) {
    super(
      'Validation failed',
      'VALIDATION_FAILED',
      HttpStatus.BAD_REQUEST
    );
  }
}

export class BusinessRuleException extends AppException {
  constructor(message: string, code: string) {
    super(message, code, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class AuthorizationException extends AppException {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
  }
}