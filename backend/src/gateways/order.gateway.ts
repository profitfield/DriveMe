// src/gateways/order.gateway.ts

import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody
  } from '@nestjs/websockets';
  import { UseGuards } from '@nestjs/common';
  import { Server, Socket } from 'socket.io';
  import { WebSocketAuthGuard } from '../guards/websocket-auth.guard';
  import { OrderStatusUpdate, DriverLocation, OrderChatMessage } from '../interfaces/websocket/order-events.interface';
  import { Logger } from '@nestjs/common';
  
  @WebSocketGateway({
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    namespace: 'orders'
  })
  export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private readonly logger = new Logger(OrderGateway.name);
    private readonly connectedClients = new Map<string, Socket>();
    private readonly driverLocations = new Map<string, DriverLocation>();
  
    async handleConnection(client: Socket) {
      try {
        const userId = client.data.user?.sub;
        if (userId) {
          this.connectedClients.set(userId, client);
          client.join(`user:${userId}`);
          this.logger.log(`Клиент подключен: ${userId}`);
        }
      } catch (error) {
        this.logger.error(`Ошибка при подключении: ${error.message}`);
      }
    }
  
    async handleDisconnect(client: Socket) {
      try {
        const userId = client.data.user?.sub;
        if (userId) {
          this.connectedClients.delete(userId);
          client.leave(`user:${userId}`);
          this.logger.log(`Клиент отключен: ${userId}`);
        }
      } catch (error) {
        this.logger.error(`Ошибка при отключении: ${error.message}`);
      }
    }
  
    @UseGuards(WebSocketAuthGuard)
    @SubscribeMessage('orderStatus')
    async handleOrderStatus(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: OrderStatusUpdate
    ): Promise<void> {
      try {
        this.server.to(`order:${data.orderId}`).emit('orderStatusUpdated', {
          ...data,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error(`Ошибка обновления статуса заказа: ${error.message}`);
      }
    }
  
    @UseGuards(WebSocketAuthGuard)
    @SubscribeMessage('driverLocation')
    async handleDriverLocation(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: DriverLocation
    ): Promise<void> {
      try {
        this.driverLocations.set(data.driverId, {
          ...data,
          timestamp: new Date()
        });
        this.server.to(`order:${data.driverId}`).emit('driverLocationUpdated', data);
      } catch (error) {
        this.logger.error(`Ошибка обновления локации водителя: ${error.message}`);
      }
    }
  
    @UseGuards(WebSocketAuthGuard)
    @SubscribeMessage('chatMessage')
    async handleChatMessage(
      @ConnectedSocket() client: Socket,
      @MessageBody() message: OrderChatMessage
    ): Promise<void> {
      try {
        this.server.to(`order:${message.orderId}`).emit('newChatMessage', {
          ...message,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error(`Ошибка отправки сообщения: ${error.message}`);
      }
    }
  
    // Методы для внешнего использования
    notifyOrderCreated(orderId: string, orderData: any): void {
      this.server.to('available_drivers').emit('newOrder', {
        orderId,
        ...orderData,
        timestamp: new Date()
      });
    }
  
    notifyOrderAssigned(orderId: string, driverId: string): void {
      this.server.to(`order:${orderId}`).emit('orderAssigned', {
        orderId,
        driverId,
        timestamp: new Date()
      });
    }
  
    notifyOrderCancelled(orderId: string, reason: string): void {
      this.server.to(`order:${orderId}`).emit('orderCancelled', {
        orderId,
        reason,
        timestamp: new Date()
      });
    }
  }