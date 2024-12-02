// src/gateways/app.gateway.ts

import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WsResponse,
    ConnectedSocket,
    MessageBody
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { UseGuards } from '@nestjs/common';
  import { WsJwtGuard } from '../guards/ws-jwt.guard';
  import { OrderStatus } from '../entities/order.entity';
  import { DriverStatus } from '../entities/driver.entity';
  
  interface LocationUpdate {
    latitude: number;
    longitude: number;
    driverId: string;
  }
  
  @WebSocketGateway({
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  })
  export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private userSockets: Map<string, Socket> = new Map();
    private driverLocations: Map<string, LocationUpdate> = new Map();
  
    async handleConnection(client: Socket) {
      const userId = this.getUserIdFromSocket(client);
      if (userId) {
        this.userSockets.set(userId, client);
        client.join(`user:${userId}`);
      }
    }
  
    async handleDisconnect(client: Socket) {
      const userId = this.getUserIdFromSocket(client);
      if (userId) {
        this.userSockets.delete(userId);
        client.leave(`user:${userId}`);
      }
    }
  
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('orderStatus')
    async handleOrderStatus(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { orderId: string; status: OrderStatus }
    ): Promise<void> {
      const { orderId, status } = data;
      // Отправляем обновление всем участникам заказа
      this.server.to(`order:${orderId}`).emit('orderStatusUpdated', {
        orderId,
        status,
        timestamp: new Date()
      });
    }
  
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('driverLocation')
    async handleDriverLocation(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: LocationUpdate
    ): Promise<void> {
      const { driverId, latitude, longitude } = data;
      
      // Сохраняем последнее местоположение водителя
      this.driverLocations.set(driverId, {
        driverId,
        latitude,
        longitude
      });
  
      // Отправляем обновление всем клиентам, связанным с этим водителем
      this.server.to(`driver:${driverId}`).emit('driverLocationUpdated', {
        driverId,
        latitude,
        longitude,
        timestamp: new Date()
      });
    }
  
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('driverStatus')
    async handleDriverStatus(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { driverId: string; status: DriverStatus }
    ): Promise<void> {
      const { driverId, status } = data;
      this.server.emit('driverStatusUpdated', {
        driverId,
        status,
        timestamp: new Date()
      });
    }
  
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('joinOrder')
    async handleJoinOrder(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { orderId: string }
    ): Promise<void> {
      const { orderId } = data;
      client.join(`order:${orderId}`);
    }
  
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('leaveOrder')
    async handleLeaveOrder(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { orderId: string }
    ): Promise<void> {
      const { orderId } = data;
      client.leave(`order:${orderId}`);
    }
  
    // Вспомогательные методы
    private getUserIdFromSocket(client: Socket): string | null {
      const user = (client as any).user;
      return user ? user.id : null;
    }
  
    // Методы для внешнего использования
    public notifyOrderCreated(orderId: string, order: any): void {
      this.server.to('available_drivers').emit('newOrder', {
        orderId,
        order,
        timestamp: new Date()
      });
    }
  
    public notifyOrderAssigned(orderId: string, driverId: string): void {
      this.server.to(`order:${orderId}`).emit('orderAssigned', {
        orderId,
        driverId,
        timestamp: new Date()
      });
    }
  
    public notifyOrderCancelled(orderId: string, reason: string): void {
      this.server.to(`order:${orderId}`).emit('orderCancelled', {
        orderId,
        reason,
        timestamp: new Date()
      });
    }
  }