import {
    WebSocketGateway as NestWebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
  } from '@nestjs/websockets';
  import { UseGuards } from '@nestjs/common';
  import { Server, Socket } from 'socket.io';
  import { WebSocketSecurityService } from '../services/websocket-security.service';
  import { JwtAuthGuard } from '../guards/jwt-auth.guard';
  import { websocketConfig } from '../config/websocket.config';
  import { WebSocketMessage, WebSocketEvent } from '../interfaces/websocket.interface';
  import { AuditService, AuditActionType, AuditLogLevel } from '../services/audit.service';
  
  @NestWebSocketGateway(websocketConfig.server)
  export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    constructor(
      private readonly wsSecurityService: WebSocketSecurityService,
      private readonly auditService: AuditService
    ) {}
  
    async handleConnection(client: Socket) {
      try {
        const token = client.handshake.auth.token;
        if (!token) {
          throw new Error('No authentication token provided');
        }
  
        const isValid = await this.wsSecurityService.handleConnection(client, token);
        if (!isValid) {
          client.disconnect();
          return;
        }
  
        await this.joinUserRooms(client);
  
      } catch (error) {
        await this.auditService.log(
            AuditActionType.WS_ERROR,
            AuditLogLevel.ERROR,
            {
              metadata: {
                error: error.message,
                clientId: client.id
              }
            }
          );
          client.disconnect();
        }
      }
    
      async handleDisconnect(client: Socket) {
        await this.wsSecurityService.handleDisconnect(client.id);
      }
    
      @UseGuards(JwtAuthGuard)
      @SubscribeMessage(WebSocketEvent.CHAT_MESSAGE)
      async handleChatMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() message: WebSocketMessage
      ) {
        try {
          const { isValid, decrypted } = await this.wsSecurityService.validateIncomingMessage(
            JSON.stringify(message),
            client.id
          );
    
          if (!isValid) {
            throw new Error('Invalid message');
          }
    
          const encrypted = await this.wsSecurityService.prepareOutgoingMessage(decrypted);
          
          this.server.to(message.channel).emit('message', {
            ...message,
            data: encrypted,
            timestamp: Date.now()
          });
    
          await this.auditService.log(
            AuditActionType.WS_MESSAGE_SENT,
            AuditLogLevel.INFO,
            {
              userId: client.id,
              metadata: {
                channel: message.channel,
                timestamp: Date.now()
              }
            }
          );
    
        } catch (error) {
          client.emit(WebSocketEvent.ERROR, {
            message: 'Failed to process message',
            timestamp: Date.now()
          });
    
          await this.auditService.log(
            AuditActionType.WS_ERROR,
            AuditLogLevel.ERROR,
            {
              userId: client.id,
              metadata: {
                error: error.message,
                channel: message.channel
              }
            }
          );
        }
      }
    
      @UseGuards(JwtAuthGuard)
      @SubscribeMessage(WebSocketEvent.ORDER_STATUS)
      async handleOrderStatus(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: any
      ) {
        try {
          const { isValid, decrypted } = await this.wsSecurityService.validateIncomingMessage(
            JSON.stringify(data),
            client.id
          );
    
          if (!isValid) {
            throw new Error('Invalid message');
          }
    
          // Здесь будет логика обработки статуса заказа
          // TODO: Реализовать обработку статуса заказа
    
          await this.auditService.log(
            AuditActionType.ORDER_UPDATE,
            AuditLogLevel.INFO,
            {
              userId: client.id,
              metadata: {
                orderId: data.orderId,
                status: data.status,
                timestamp: Date.now()
              }
            }
          );
    
        } catch (error) {
          client.emit(WebSocketEvent.ERROR, {
            message: 'Failed to update order status',
            timestamp: Date.now()
          });
    
          await this.auditService.log(
            AuditActionType.WS_ERROR,
            AuditLogLevel.ERROR,
            {
              userId: client.id,
              metadata: {
                error: error.message,
                orderId: data?.orderId
              }
            }
          );
        }
      }
    
      @UseGuards(JwtAuthGuard)
      @SubscribeMessage(WebSocketEvent.ORDER_LOCATION)
      async handleOrderLocation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: any
      ) {
        try {
          const { isValid, decrypted } = await this.wsSecurityService.validateIncomingMessage(
            JSON.stringify(data),
            client.id
          );
    
          if (!isValid) {
            throw new Error('Invalid message');
          }
    
          // Здесь будет логика обновления локации
          // TODO: Реализовать обновление локации
    
          await this.auditService.log(
            AuditActionType.DRIVER_LOCATION,
            AuditLogLevel.INFO,
            {
              userId: client.id,
              metadata: {
                orderId: data.orderId,
                location: data.location,
                timestamp: Date.now()
              }
            }
          );
    
        } catch (error) {
          client.emit(WebSocketEvent.ERROR, {
            message: 'Failed to update location',
            timestamp: Date.now()
          });
    
          await this.auditService.log(
            AuditActionType.WS_ERROR,
            AuditLogLevel.ERROR,
            {
              userId: client.id,
              metadata: {
                error: error.message,
                orderId: data?.orderId
              }
            }
          );
        }
      }
    
      private async joinUserRooms(client: Socket) {
        try {
          // Получаем информацию о пользователе из токена
          const user = client.handshake.auth.user;
    
          // Присоединяем к личной комнате
          client.join(`user:${user.id}`);
    
          // Если это водитель, присоединяем к комнате водителей
          if (user.role === 'driver') {
            client.join('drivers');
          }
    
          // Присоединяем к комнатам активных заказов
          // TODO: Реализовать получение активных заказов пользователя
          const activeOrders = []; // Здесь будет запрос к БД
          for (const order of activeOrders) {
            client.join(`order:${order.id}`);
          }
    
        } catch (error) {
          await this.auditService.log(
            AuditActionType.WS_ERROR,
            AuditLogLevel.ERROR,
            {
              userId: client.id,
              metadata: {
                error: error.message,
                action: 'joinUserRooms'
              }
            }
          );
        }
      }
    }