import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SecurityLogger } from '../services/logger.service';
import { RedisService } from '../services/redis.service';

@Injectable()
export class SecurityMonitoringGuard implements CanActivate {
  constructor(
    private securityLogger: SecurityLogger,
    private redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const path = request.path;
    const method = request.method;
    const userId = request.user?.id;

    // Проверяем подозрительные паттерны в запросе
    const isSuspicious = await this.checkForSuspiciousPatterns(request);
    if (isSuspicious) {
      await this.handleSuspiciousActivity(ip, request);
      return false;
    }

    // Логируем активность
    this.securityLogger.logUserActivity({
      userId: userId || 'anonymous',
      action: method,
      resource: path,
      ip,
      metadata: {
        userAgent: request.headers['user-agent'],
        referer: request.headers.referer
      }
    });

    return true;
  }

  private async checkForSuspiciousPatterns(request: any): Promise<boolean> {
    const suspiciousPatterns = [
      // SQL инъекции
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      // Cross-site scripting
      /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
      // Путь к файлу
      /\.\.(\/|\%2F)/i
    ];

    const checkFields = [
      request.params,
      request.query,
      request.body
    ];

    for (const field of checkFields) {
      for (const pattern of suspiciousPatterns) {
        if (this.checkObjectForPattern(field, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  private checkObjectForPattern(obj: any, pattern: RegExp): boolean {
    if (!obj) return false;
    
    if (typeof obj === 'string') {
      return pattern.test(obj);
    }

    if (typeof obj === 'object') {
      return Object.values(obj).some(value => 
        this.checkObjectForPattern(value, pattern)
      );
    }

    return false;
  }

  private async handleSuspiciousActivity(ip: string, request: any) {
    // Увеличиваем счетчик подозрительной активности
    const key = `suspicious:${ip}`;
    const count = await this.redisService.incr(key);
    await this.redisService.expire(key, 3600); // 1 час

    // Логируем событие
    this.securityLogger.logSecurityViolation({
      type: 'suspicious_activity',
      description: 'Detected potentially malicious patterns in request',
      ip,
      headers: request.headers,
      payload: {
        body: request.body,
        query: request.query,
        params: request.params
      }
    });

    // Если много подозрительной активности, блокируем IP
    if (count > 5) {
      await this.blockIp(ip);
    }
  }

  private async blockIp(ip: string) {
    await this.redisService.set(`blocked:${ip}`, 'true', 86400); // 24 часа
    
    this.securityLogger.logSecurityEvent({
      type: 'attack',
      severity: 'high',
      message: `IP address ${ip} has been blocked due to suspicious activity`,
      ip
    });
  }
}