import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { EncryptionService } from './encryption.service';
import { SecurityLogger } from './logger.service';

@Injectable()
export class SecureStorageService {
  private readonly sensitiveFields = [
    'phoneNumber',
    'personalId',
    'driverLicense',
    'bankAccount'
  ];

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly securityLogger: SecurityLogger
  ) {}

  /**
   * Шифрование чувствительных полей в объекте
   */
  encryptSensitiveData<T extends object>(data: T): T {
    const encryptedData = { ...data };
    
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.includes(key) && value) {
        encryptedData[key] = this.encryptionService.encrypt(value);
      }
    }
    
    return encryptedData;
  }

  /**
   * Расшифровка чувствительных полей
   */
  decryptSensitiveData<T extends object>(data: T): T {
    const decryptedData = { ...data };
    
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.includes(key) && value) {
        try {
          decryptedData[key] = this.encryptionService.decrypt(value);
        } catch (error) {
          this.securityLogger.logSecurityEvent({
            type: 'modification',
            severity: 'high',
            message: `Failed to decrypt field: ${key}`,
            metadata: { error: error.message }
          });
          decryptedData[key] = null;
        }
      }
    }
    
    return decryptedData;
  }

  /**
   * Маскирование чувствительных данных для логов
   */
  maskSensitiveData<T extends object>(data: T): T {
    const maskedData = { ...data };
    
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.includes(key) && value) {
        maskedData[key] = this.encryptionService.maskSensitiveData(value);
      }
    }
    
    return maskedData;
  }

  /**
   * Безопасное удаление данных
   */
  async secureClearData(data: any): Promise<void> {
    // Перезаписываем данные случайными значениями перед удалением
    if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (this.sensitiveFields.includes(key)) {
          data[key] = crypto.randomBytes(32).toString('hex');
        }
      }
    }
  }
}