// src/services/notification-queue.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { OrderStatus } from '../entities/order.entity';

export interface NotificationJobPayload {
  order?: any;
  status?: OrderStatus;
  message?: string;
  fromUser?: any;
  toUser?: any;
  orderId?: string;
  adminTelegramIds?: string[];
  severity?: 'info' | 'warning' | 'error';
  additionalData?: Record<string, any>;
}

export interface NotificationJobData {
  type: 'orderStatus' | 'chat' | 'system';
  payload: NotificationJobPayload;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly maxRetries = 3;

  constructor(
    @InjectQueue('notifications') private notificationQueue: Queue<NotificationJobData>
  ) {}

  async addToQueue(data: NotificationJobData): Promise<void> {
    try {
      await this.notificationQueue.add(data.type, {
        type: data.type,
        payload: data.payload
      }, {
        attempts: this.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: false
      });

      this.logger.debug(
        `Задача добавлена в очередь: ${data.type}, payload: ${JSON.stringify(data.payload)}`
      );
    } catch (error) {
      this.logger.error(
        `Ошибка добавления задачи в очередь: ${error.message}`,
        error.stack
      );
    }
  }

  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.notificationQueue.getWaitingCount(),
        this.notificationQueue.getActiveCount(),
        this.notificationQueue.getCompletedCount(),
        this.notificationQueue.getFailedCount()
      ]);

      return { waiting, active, completed, failed };
    } catch (error) {
      this.logger.error(`Ошибка получения статуса очереди: ${error.message}`);
      throw error;
    }
  }

  async getFailedJobs(): Promise<Job<NotificationJobData>[]> {
    try {
      return await this.notificationQueue.getFailed();
    } catch (error) {
      this.logger.error(`Ошибка получения неудачных задач: ${error.message}`);
      throw error;
    }
  }

  async retryFailedJobs(): Promise<void> {
    try {
      const failedJobs = await this.getFailedJobs();
      for (const job of failedJobs) {
        await job.retry();
      }
      this.logger.log(`Повторная попытка для ${failedJobs.length} неудачных задач`);
    } catch (error) {
      this.logger.error(`Ошибка повторной попытки неудачных задач: ${error.message}`);
      throw error;
    }
  }

  async cleanQueue(): Promise<void> {
    try {
      await this.notificationQueue.clean(24 * 3600 * 1000, 'completed');
      await this.notificationQueue.clean(7 * 24 * 3600 * 1000, 'failed');
      this.logger.log('Очередь очищена');
    } catch (error) {
      this.logger.error(`Ошибка очистки очереди: ${error.message}`);
      throw error;
    }
  }

  async pauseQueue(): Promise<void> {
    try {
      await this.notificationQueue.pause();
      this.logger.log('Очередь приостановлена');
    } catch (error) {
      this.logger.error(`Ошибка приостановки очереди: ${error.message}`);
      throw error;
    }
  }

  async resumeQueue(): Promise<void> {
    try {
      await this.notificationQueue.resume();
      this.logger.log('Очередь возобновлена');
    } catch (error) {
      this.logger.error(`Ошибка возобновления очереди: ${error.message}`);
      throw error;
    }
  }

  async removeJob(jobId: string): Promise<void> {
    try {
      const job = await this.notificationQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Задача ${jobId} удалена`);
      }
    } catch (error) {
      this.logger.error(`Ошибка удаления задачи ${jobId}: ${error.message}`);
      throw error;
    }
  }
}