// src/exceptions/order.exception.ts

import { HttpStatus } from '@nestjs/common';
import { AppException } from './base.exception';

export class OrderNotFoundException extends AppException {
  constructor(orderId: string) {
    super(
      `Order with id ${orderId} not found`,
      'ORDER_NOT_FOUND',
      HttpStatus.NOT_FOUND
    );
  }
}

export class InvalidOrderStatusException extends AppException {
  constructor(currentStatus: string, requiredStatus: string) {
    super(
      `Invalid order status. Current: ${currentStatus}, Required: ${requiredStatus}`,
      'INVALID_ORDER_STATUS',
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}

export class DriverAssignmentException extends AppException {
  constructor(message: string) {
    super(
      message,
      'DRIVER_ASSIGNMENT_FAILED',
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}

// src/exceptions/driver.exception.ts

export class DriverNotFoundException extends AppException {
  constructor(driverId: string) {
    super(
      `Driver with id ${driverId} not found`,
      'DRIVER_NOT_FOUND',
      HttpStatus.NOT_FOUND
    );
  }
}

export class DriverNotAvailableException extends AppException {
  constructor(driverId: string) {
    super(
      `Driver ${driverId} is not available`,
      'DRIVER_NOT_AVAILABLE',
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}