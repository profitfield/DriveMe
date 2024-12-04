// src/interfaces/websocket/order-events.interface.ts

import { OrderStatus } from '../../entities/order.entity';

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

export interface OrderAssignment {
  orderId: string;
  driverId: string;
  timestamp: Date;
}

export interface OrderChatMessage {
  orderId: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date;
}