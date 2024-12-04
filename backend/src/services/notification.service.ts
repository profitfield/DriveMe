// src/services/notification.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { TelegramService } from './telegram.service';
import { OrderStatus } from '../entities/order.entity';

interface NotificationTemplate {
  client: string;
  driver: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly templates: Record<OrderStatus, NotificationTemplate>;

  constructor(
    @InjectQueue('notifications') private notificationQueue: Queue,
    private readonly telegramService: TelegramService,
  ) {
    this.templates = {
      [OrderStatus.CREATED]: {
        client: 'Ваш заказ #{orderId} создан и ожидает подтверждения водителем.',
        driver: 'Новый заказ #{orderId} доступен для принятия.'
      },
      [OrderStatus.DRIVER_ASSIGNED]: {
        client: 'Водитель {driverName} принял ваш заказ #{orderId}.',
        driver: 'Вы приняли заказ #{orderId}. Свяжитесь с клиентом для уточнения деталей.'
      },
      [OrderStatus.CONFIRMED]: {
        client: 'Заказ #{orderId} подтвержден. Ожидайте прибытия водителя.',
        driver: 'Заказ #{orderId} подтвержден. Приступайте к выполнению.'
      },
      [OrderStatus.EN_ROUTE]: {
        client: 'Водитель выехал и направляется к вам. Ожидаемое время прибытия: {eta}.',
        driver: 'Вы направляетесь к клиенту. Заказ #{orderId}.'
      },
      [OrderStatus.ARRIVED]: {
        client: 'Водитель прибыл на место подачи.',
        driver: 'Вы прибыли на место подачи. Ожидайте клиента.'
      },
      [OrderStatus.STARTED]: {
        client: 'Поездка началась.',
        driver: 'Поездка началась. Счетчик времени запущен.'
      },
      [OrderStatus.COMPLETED]: {
        client: 'Поездка завершена. Сумма: {price}₽. Спасибо за использование нашего сервиса!',
        driver: 'Поездка завершена. Ваш заработок: {driverEarnings}₽.'
      },
      [OrderStatus.CANCELLED]: {
        client: 'Заказ #{orderId} отменен. Причина: {reason}',
        driver: 'Заказ #{orderId} отменен. Причина: {reason}'
      }
    };
  }

  async sendOrderStatusNotification(
    order: any,
    status: OrderStatus,
    additionalData: Record<string, any> = {}
  ): Promise<void> {
    try {
      const template = this.templates[status];
      if (!template) {
        this.logger.warn(`Шаблон не найден для статуса: ${status}`);
        return;
      }

      const jobData = {
        type: 'orderStatus',
        clientMessage: this.formatMessage(template.client, {
          orderId: order.id,
          driverName: order.driver?.user?.firstName,
          ...additionalData
        }),
        driverMessage: order.driver ? this.formatMessage(template.driver, {
          orderId: order.id,
          ...additionalData
        }) : null,
        recipients: {
          clientId: order.client.telegramId,
          driverId: order.driver?.user?.telegramId
        },
        timestamp: new Date(),
        metadata: {
          orderId: order.id,
          status,
          additionalData
        }
      };

      await this.notificationQueue.add('sendNotification', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });

      this.logger.log(`Уведомление о статусе заказа добавлено в очередь: ${order.id}`);
    } catch (error) {
      this.logger.error(
        `Ошибка добавления уведомления в очередь для заказа ${order.id}: ${error.message}`,
        error.stack
      );
    }
  }

  async sendSystemAlert(
    message: string,
    severity: 'info' | 'warning' | 'error' = 'info',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.notificationQueue.add('systemAlert', {
        message,
        severity,
        metadata,
        timestamp: new Date()
      });

      this.logger.log(`Системное уведомление добавлено в очередь: ${severity}`);
    } catch (error) {
      this.logger.error(
        `Ошибка отправки системного уведомления: ${error.message}`,
        error.stack
      );
    }
  }

  private formatMessage(template: string, data: Record<string, any>): string {
    return template.replace(
      /{(\w+)}/g,
      (match, key) => {
        const value = data[key];
        return value !== undefined ? value.toString() : match;
      }
    );
  }

  async clearFailedJobs(): Promise<void> {
    try {
      const failedJobs = await this.notificationQueue.getFailed();
      for (const job of failedJobs) {
        await job.remove();
      }
      this.logger.log('Очистка неудачных задач завершена');
    } catch (error) {
      this.logger.error('Ошибка при очистке неудачных задач', error.stack);
    }
  }
}