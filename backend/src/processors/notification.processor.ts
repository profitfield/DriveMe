// backend/src/processors/notification.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TelegramService } from '../services/telegram.service';
import { NotificationJobData, NotificationJobPayload } from '../services/notification-queue.service';

@Processor('notifications')
export class NotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(private readonly telegramService: TelegramService) {}

    @Process('orderStatus')
    async handleOrderNotification(job: Job<NotificationJobData>): Promise<void> {
        try {
            const { payload } = job.data;
            const { order, status, additionalData } = payload;

            if (!order) {
                throw new Error('Order data is missing');
            }

            // Уведомление клиента
            if (order.client?.id) {
                const clientMessage = this.formatClientMessage(status, additionalData);
                await this.telegramService.sendMessage(order.client.id, clientMessage);
                this.logger.log(`Уведомление отправлено клиенту: ${order.client.id}`);
            }

            // Уведомление водителя
            if (order.driver?.id) {
                const driverMessage = this.formatDriverMessage(status, additionalData);
                await this.telegramService.sendMessage(order.driver.id, driverMessage);
                this.logger.log(`Уведомление отправлено водителю: ${order.driver.id}`);
            }

        } catch (error) {
            this.logger.error(
                `Ошибка обработки уведомления заказа: ${error.message}`,
                error.stack
            );
            throw error;
        }
    }

    @Process('system')
    async handleSystemAlert(job: Job<NotificationJobData>): Promise<void> {
        try {
            const { message, severity, additionalData } = job.data.payload;
            const formattedMessage = this.formatSystemMessage(message, severity, additionalData);

            // Отправляем системное уведомление администраторам
            // В MVP версии логируем
            this.logger.warn(`Системное уведомление: ${formattedMessage}`);

        } catch (error) {
            this.logger.error(
                `Ошибка обработки системного уведомления: ${error.message}`,
                error.stack
            );
            throw error;
        }
    }

    private formatClientMessage(status: string, data: any): string {
        const templates = {
            CREATED: 'Ваш заказ #{orderId} создан. Стоимость: {price}₽',
            DRIVER_ASSIGNED: 'Водитель {driverName} принял ваш заказ',
            EN_ROUTE: 'Водитель выехал. Ожидаемое время прибытия: {eta}',
            ARRIVED: 'Водитель прибыл на место подачи',
            STARTED: 'Поездка началась',
            COMPLETED: 'Поездка завершена. Сумма: {price}₽',
            CANCELLED: 'Заказ отменен. Причина: {reason}'
        };

        let message = templates[status] || `Статус заказа изменен на: ${status}`;
        
        // Подставляем данные
        Object.entries(data || {}).forEach(([key, value]) => {
            message = message.replace(`{${key}}`, value);
        });

        return message;
    }

    private formatDriverMessage(status: string, data: any): string {
        const templates = {
            DRIVER_ASSIGNED: 'Новый заказ #{orderId}',
            CONFIRMED: 'Заказ #{orderId} подтвержден',
            COMPLETED: 'Заказ #{orderId} завершен. Ваш заработок: {driverEarnings}₽',
            CANCELLED: 'Заказ #{orderId} отменен. Причина: {reason}'
        };

        let message = templates[status] || `Статус заказа изменен на: ${status}`;
        
        Object.entries(data || {}).forEach(([key, value]) => {
            message = message.replace(`{${key}}`, value);
        });

        return message;
    }

    private formatSystemMessage(message: string, severity: string, data: any): string {
        return `[${severity.toUpperCase()}] ${message}\n\nДетали: ${JSON.stringify(data, null, 2)}`;
    }

    async onQueueActive(job: Job) {
        this.logger.debug(`Начало обработки задачи ${job.id} типа ${job.name}`);
    }

    async onQueueCompleted(job: Job) {
        this.logger.debug(`Задача ${job.id} типа ${job.name} успешно выполнена`);
    }

    async onQueueFailed(job: Job, error: Error) {
        this.logger.error(
            `Задача ${job.id} типа ${job.name} завершилась с ошибкой: ${error.message}`,
            error.stack
        );
    }
}