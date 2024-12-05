// backend/src/services/notification.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '../entities/order.entity';
import { TelegramService } from './telegram.service';

interface NotificationPayload {
   type: 'order_created' | 'driver_assigned' | 'status_updated' | 'order_cancelled';
   order: any;
   recipientId: string;
   additionalData?: Record<string, any>;
}

interface SystemNotification {
   message: string;
   severity: 'info' | 'warning' | 'error';
   additionalData?: Record<string, any>;
}

@Injectable()
export class NotificationService {
   private readonly logger = new Logger(NotificationService.name);

   constructor(
       private readonly telegramService: TelegramService
   ) {}

   async sendOrderNotification(payload: NotificationPayload): Promise<void> {
       try {
           const message = this.formatOrderMessage(
               payload.type, 
               payload.order, 
               payload.additionalData
           );

           await this.telegramService.sendMessage(
               payload.recipientId,
               message
           );

           this.logger.debug(`Notification sent to ${payload.recipientId}: ${message}`);
       } catch (error) {
           this.logger.error(
               `Failed to send notification: ${error.message}`,
               error.stack
           );
       }
   }

   async sendSystemNotification(notification: SystemNotification): Promise<void> {
       try {
           const message = this.formatSystemMessage(
               notification.message,
               notification.severity,
               notification.additionalData
           );

           // В MVP просто логируем системные уведомления
           this.logger.warn(message);
       } catch (error) {
           this.logger.error(
               `Failed to send system notification: ${error.message}`,
               error.stack
           );
       }
   }

   private formatOrderMessage(
       type: string,
       order: any,
       data?: Record<string, any>
   ): string {
       const templates = {
           order_created: 'Заказ #{orderId} создан\nСтоимость: {price}₽',
           driver_assigned: 'Водитель {driverName} принял ваш заказ',
           status_updated: this.getStatusTemplate(order.status),
           order_cancelled: 'Заказ #{orderId} отменен\nПричина: {reason}'
       };

       let message = templates[type] || `Обновление заказа №${order.id}`;
       
       // Подставляем данные заказа
       message = message
           .replace('{orderId}', order.id)
           .replace('{price}', data?.price || order.estimatedPrice);

       // Подставляем дополнительные данные
       if (data) {
           Object.entries(data).forEach(([key, value]) => {
               message = message.replace(`{${key}}`, value);
           });
       }

       return message;
   }

   private getStatusTemplate(status: OrderStatus): string {
       const templates = {
           [OrderStatus.CREATED]: 'Заказ создан и ожидает подтверждения',
           [OrderStatus.DRIVER_ASSIGNED]: 'Водитель назначен',
           [OrderStatus.CONFIRMED]: 'Заказ подтвержден',
           [OrderStatus.EN_ROUTE]: 'Водитель выехал. Ожидаемое время прибытия: {eta}',
           [OrderStatus.ARRIVED]: 'Водитель прибыл на место',
           [OrderStatus.STARTED]: 'Поездка началась',
           [OrderStatus.COMPLETED]: 'Поездка завершена\nСтоимость: {price}₽',
           [OrderStatus.CANCELLED]: 'Заказ отменен\nПричина: {reason}'
       };

       return templates[status] || `Статус заказа: ${status}`;
   }

   private formatSystemMessage(
       message: string,
       severity: string,
       data?: Record<string, any>
   ): string {
       let formattedMessage = `[${severity.toUpperCase()}] ${message}`;
       
       if (data) {
           formattedMessage += '\nДетали: ' + JSON.stringify(data, null, 2);
       }

       return formattedMessage;
   }
}