// src/modules/assignment/assignment.interface.ts

import { Driver } from '../../entities/driver.entity';
import { Order } from '../../entities/order.entity';
import { CarClass } from '../../entities/driver.entity';

export interface DriverScore {
  driver: Driver;
  score: number;
}

export interface AssignmentCriteria {
  orderId: string;
  carClass: CarClass;  // Используем enum CarClass вместо string
  pickupDatetime: Date;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface AssignmentResult {
  success: boolean;
  order?: Order;
  driver?: Driver;
  message?: string;
}