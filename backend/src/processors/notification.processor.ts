// src/processors/notification.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TelegramService } from '../services/telegram.service';

interface NotificationJob {
  type: 'orderStatus' | 'systemAlert';
  clientMessage?: string;
  driverMessage?: string;
  recipients?: {
    clientId?: string;
    driverId?: string;
  };
  message?: string;
  severity?: 'info' | 'warning' | 'error';
  metadata: Record<string, any>;
  timestamp: Date;
}

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Process('sendNotification')
  async handleOrderNotification(job: Job<NotificationJob>): Promise<void> {
    try {
      const { clientMessage, driverMessage, recipients } = job.data;

      if (clientMessage && recipients?.clientId) {
        await this.telegramService.sendMessage(recipients.clientId, clientMessage);
        this.logger.log(`Уведомление отправлено клиенту: ${recipients.clientId}`);
      }

      if (driverMessage && recipients?.driverId) {
        await this.telegramService.sendMessage(recipients.driverId, driverMessage);
        this.logger.log(`Уведомление отправлено водителю: ${recipients.driverId}`);
      }

    } catch (error) {
      this.logger.error(
        `Ошибка обработки уведомления заказа: ${error.message}`,
        error.stack
      );
      throw error; // Пробрасываем ошибку для повторной попытки
    }
  }

  @Process('systemAlert')
  async handleSystemAlert(job: Job<NotificationJob>): Promise<void> {
    try {
      const { message, severity, metadata } = job.data;
      const formattedMessage = `[${severity.toUpperCase()}] ${message}\n\nДетали: ${JSON.stringify(metadata, null, 2)}`;

      // В реальном приложении здесь будет логика отправки системных уведомлений администраторам
      this.logger.log(`Системное уведомление: ${formattedMessage}`);

    } catch (error) {
      this.logger.error(
        `Ошибка обработки системного уведомления: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  @Process({
    name: 'sendNotification',
    concurrency: 3 // Ограничиваем количество одновременных обработок
  })
  async handleBatchNotifications(jobs: Job<NotificationJob>[]): Promise<void> {
    try {
      await Promise.all(
        jobs.map(job => this.handleOrderNotification(job))
      );
    } catch (error) {
      this.logger.error(
        `Ошибка пакетной обработки уведомлений: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async onQueueActive(job: Job) {
    this.logger.debug(
      `Начало обработки задачи ${job.id} типа ${job.name}`
    );
  }

  async onQueueCompleted(job: Job) {
    this.logger.debug(
      `Задача ${job.id} типа ${job.name} успешно выполнена`
    );
  }

  async onQueueFailed(job: Job, error: Error) {
    this.logger.error(
      `Задача ${job.id} типа ${job.name} завершилась с ошибкой: ${error.message}`,
      error.stack
    );

    // Можно добавить дополнительную логику обработки ошибок
    if (job.attemptsMade >= job.opts.attempts) {
      this.logger.warn(
        `Достигнуто максимальное количество попыток для задачи ${job.id}`
      );
    }
  }
}