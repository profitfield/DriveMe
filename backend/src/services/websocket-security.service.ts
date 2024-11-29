import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { RedisService } from './redis.service';
import { EncryptionService } from './encryption.service';

interface WebSocketSecurityConfig {
  maxConnections: number;
  messageRateLimit: {
    maxMessages: number;
    timeWindow: number;
  };
  maxMessageSize: number;
  pingInterval: number;
  timeout: number;
}

@Injectable()
export class WebSocketSecurityService {
  private readonly config: WebSocketSecurityConfig;
  private connections: Map<string, Socket> = new Map();

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private redisService: RedisService,
    private encryptionService: EncryptionService
  ) {
    this.config = {
      maxConnections: configService.get('WS_MAX_CONNECTIONS', 1000),
      messageRateLimit: {
        maxMessages: configService.get('WS_MAX_MESSAGES', 100),
        timeWindow: configService.get('WS_TIME_WINDOW', 60)
      },
      maxMessageSize: configService.get('WS_MAX_MESSAGE_SIZE', 16384),
      pingInterval: configService.get('WS_PING_INTERVAL', 30000),
      timeout: configService.get('WS_TIMEOUT', 120000)
    };
  }

  async handleConnection(client: Socket, token: string): Promise<boolean> {
    try {
      if (this.connections.size >= this.config.maxConnections) {
        throw new Error('Maximum connections limit reached');
      }

      const payload = await this.validateToken(token);
      const userId = payload.sub;

      await this.checkUserConnections(userId);
      this.setupConnection(client, userId);
      await this.logConnection(userId);

      return true;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'medium',
        message: 'WebSocket connection failed',
        metadata: { error: error.message }
      });

      client.disconnect();
      return false;
    }
  }

  async validateIncomingMessage(
    message: string,
    userId: string
  ): Promise<{ isValid: boolean; decrypted?: string }> {
    try {
      if (message.length > this.config.maxMessageSize) {
        throw new Error('Message size exceeds limit');
      }

      if (!await this.checkMessageRateLimit(userId)) {
        throw new Error('Message rate limit exceeded');
      }

      const decrypted = await this.encryptionService.decrypt(message);

      if (!this.validateMessageContent(decrypted)) {
        throw new Error('Invalid message content');
      }

      return { isValid: true, decrypted };
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'Invalid WebSocket message',
        userId,
        metadata: { error: error.message }
      });

      return { isValid: false };
    }
  }

  async prepareOutgoingMessage(message: string): Promise<string> {
    return this.encryptionService.encrypt(message);
  }

  async handleDisconnect(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      this.connections.delete(userId);
      await this.clearUserRateLimits(userId);

      await this.auditService.log(
        AuditActionType.WS_CONNECTION_CLOSED,
        AuditLogLevel.INFO,
        {
          userId,
          metadata: { reason: 'client_disconnected' }
        }
      );
    }
  }

  private async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private async checkUserConnections(userId: string): Promise<void> {
    const existingConnection = this.connections.get(userId);
    if (existingConnection) {
      existingConnection.disconnect();
      this.connections.delete(userId);
    }
  }

  private setupConnection(client: Socket, userId: string): void {
    this.connections.set(userId, client);

    let lastPong = Date.now();
    
    const pingInterval = setInterval(() => {
      if (Date.now() - lastPong > this.config.timeout) {
        clearInterval(pingInterval);
        client.disconnect();
        return;
      }
      client.emit('ping');
    }, this.config.pingInterval);

    client.on('pong', () => {
      lastPong = Date.now();
    });

    client.on('disconnect', () => {
      clearInterval(pingInterval);
      this.handleDisconnect(userId);
    });
  }

  private async checkMessageRateLimit(userId: string): Promise<boolean> {
    const key = `ws:ratelimit:${userId}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      await this.redisService.expire(key, this.config.messageRateLimit.timeWindow);
    }

    return count <= this.config.messageRateLimit.maxMessages;
  }

  private validateMessageContent(message: string): boolean {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi
    ];

    return !maliciousPatterns.some(pattern => pattern.test(message));
  }

  private async logConnection(userId: string): Promise<void> {
    await this.auditService.log(
      AuditActionType.WS_CONNECTION_OPENED,
      AuditLogLevel.INFO,
      {
        userId,
        metadata: {
          timestamp: new Date(),
          activeConnections: this.connections.size
        }
      }
    );
  }

  private async clearUserRateLimits(userId: string): Promise<void> {
    const key = `ws:ratelimit:${userId}`;
    await this.redisService.del(key);
  }
}