import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from './encryption.service';
import { SecurityLogger } from './logger.service';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '../entities/chat-message.entity';

@Injectable()
export class SecureChatService {
  private readonly messageRetentionDays = 30;
  private readonly maxMessageLength = 1000;
  private readonly allowedMessageTypes = ['text', 'location', 'system'];
  
  constructor(
    @InjectRepository(ChatMessage)
    private chatRepository: Repository<ChatMessage>,
    private encryptionService: EncryptionService,
    private securityLogger: SecurityLogger,
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  /**
   * Отправка сообщения
   */
  async sendMessage(
    orderId: string,
    senderId: string,
    recipientId: string,
    content: string,
    type: string = 'text',
    metadata?: Record<string, any>
  ): Promise<ChatMessage> {
    try {
      // Валидация входных данных
      this.validateMessage(content, type);
      await this.validateParticipants(orderId, senderId, recipientId);

      // Создаем сообщение
      const message = this.chatRepository.create({
        orderId,
        senderId,
        recipientId,
        content: await this.encryptContent(content),
        type: type as 'text' | 'location' | 'system',
        status: 'sent',
        metadata,
        createdAt: new Date()
      });

      // Сохраняем сообщение
      const savedMessage = await this.chatRepository.save(message);

      // Обновляем кэш последних сообщений
      await this.updateMessageCache(orderId, message);

      // Логируем событие
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'low',
        message: 'Chat message sent',
        userId: senderId,
        metadata: {
          orderId,
          messageId: message.id,
          type
        }
      });

      return savedMessage;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'Failed to send chat message',
        userId: senderId,
        metadata: {
          orderId,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Получение сообщений чата
   */
  async getMessages(
    orderId: string,
    userId: string,
    limit: number = 50,
    before?: Date
  ): Promise<ChatMessage[]> {
    try {
      // Проверяем доступ к чату
      await this.validateAccess(orderId, userId);

      // Сначала пробуем получить из кэша
      const cachedMessages = await this.redisService.lrange(`chat:${orderId}:messages`, 0, limit - 1);
      if (cachedMessages.length > 0) {
        return cachedMessages.map(msg => JSON.parse(msg));
      }

      // Если в кэше нет, берем из БД
      const query = this.chatRepository
        .createQueryBuilder('message')
        .where('message.orderId = :orderId', { orderId })
        .orderBy('message.createdAt', 'DESC')
        .take(limit);

      if (before) {
        query.andWhere('message.createdAt < :before', { before });
      }

      const messages = await query.getMany();

      // Расшифровываем содержимое
      const decryptedMessages = await Promise.all(
        messages.map(async (message) => ({
          ...message,
          content: await this.decryptContent(message.content)
        }))
      );

      // Обновляем статус прочтения
      await this.updateMessageStatus(messages, userId);

      return decryptedMessages;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'medium',
        message: 'Failed to get chat messages',
        userId,
        metadata: {
          orderId,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Обновление статуса сообщения
   */
  async updateMessageStatus(
    messages: ChatMessage[],
    userId: string,
    status: 'delivered' | 'read' = 'read'
  ): Promise<void> {
    try {
      const messageIds = messages
        .filter(m => m.recipientId === userId)
        .map(m => m.id);

      if (messageIds.length === 0) return;

      await this.chatRepository
        .createQueryBuilder()
        .update()
        .set({ status })
        .where('id IN (:...ids)', { ids: messageIds })
        .execute();

      // Обновляем кэш
      await Promise.all(
        messages.map(message =>
          this.updateMessageCache(message.orderId, { ...message, status })
        )
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'low',
        message: 'Failed to update message status',
        userId,
        metadata: {
          messageIds: messages.map(m => m.id),
          error: error.message
        }
      });
    }
  }

  private async validateMessage(content: string, type: string): Promise<void> {
    if (!content || content.length > this.maxMessageLength) {
      throw new Error('Invalid message length');
    }

    if (!this.allowedMessageTypes.includes(type)) {
      throw new Error('Invalid message type');
    }

    // Проверяем content на вредоносный контент
    this.validateMessageContent(content);
  }

  private validateMessageContent(content: string): void {
    // Проверка на XSS
    if (/<[^>]*script/i.test(content)) {
      throw new Error('Message contains prohibited content');
    }

    // Проверка на SQL инъекции
    if (/(\%27)|(\')|(\-\-)|(\%23)|(#)/i.test(content)) {
      throw new Error('Message contains prohibited content');
    }
  }

  private async validateParticipants(
    orderId: string,
    senderId: string,
    recipientId: string
  ): Promise<void> {
    const order = await this.getOrder(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }

    const validParticipants = [order.clientId, order.driverId];
    
    if (!validParticipants.includes(senderId) || !validParticipants.includes(recipientId)) {
      throw new Error('Invalid chat participants');
    }
  }

  private async validateAccess(orderId: string, userId: string): Promise<void> {
    const order = await this.getOrder(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.clientId !== userId && order.driverId !== userId) {
      throw new Error('Access denied');
    }
  }

  private async encryptContent(content: string): Promise<string> {
    return this.encryptionService.encrypt(content);
  }

  private async decryptContent(encryptedContent: string): Promise<string> {
    return this.encryptionService.decrypt(encryptedContent);
  }

  private async updateMessageCache(
    orderId: string,
    message: ChatMessage
  ): Promise<void> {
    const key = `chat:${orderId}:messages`;
    await this.redisService.lpush(key, JSON.stringify(message));
    await this.redisService.ltrim(key, 0, 49); // Храним последние 50 сообщений
    await this.redisService.expire(key, 86400); // TTL 24 часа
  }

  private async getOrder(orderId: string): Promise<any> {
    // TODO: Реализовать получение заказа из базы данных
    return {
      id: orderId,
      clientId: 'client_id',
      driverId: 'driver_id'
    };
  }
}