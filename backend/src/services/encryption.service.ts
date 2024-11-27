import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly saltLength = 16;
  private readonly ivLength = 12;
  private readonly tagLength = 16;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }
    
    // Создаем ключ на основе переменной окружения
    this.key = crypto.scryptSync(
      encryptionKey,
      'salt',
      32
    );
  }

  /**
   * Шифрование чувствительных данных
   */
  encrypt(data: string): string {
    // Генерируем случайный IV (вектор инициализации)
    const iv = crypto.randomBytes(this.ivLength);
    
    // Создаем шифр
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    // Шифруем данные
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    
    // Получаем тег аутентификации
    const authTag = cipher.getAuthTag();
    
    // Собираем все компоненты в одну строку
    const result = Buffer.concat([
      iv,
      Buffer.from(encryptedData, 'hex'),
      authTag
    ]).toString('base64');
    
    return result;
  }

  /**
   * Расшифровка данных
   */
  decrypt(encryptedData: string): string {
    try {
      // Декодируем из base64
      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Извлекаем компоненты
      const iv = buffer.slice(0, this.ivLength);
      const authTag = buffer.slice(-this.tagLength);
      const data = buffer.slice(this.ivLength, -this.tagLength);
      
      // Создаем дешифратор
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      // Расшифровываем данные
      let decrypted = decipher.update(data.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Хеширование паролей
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt.toString('base64')}.${derivedKey.toString('base64')}`);
      });
    });
  }

  /**
   * Проверка пароля
   */
  async verifyPassword(storedHash: string, password: string): Promise<boolean> {
    try {
      const [salt, hash] = storedHash.split('.');
      const saltBuffer = Buffer.from(salt, 'base64');
      const hashBuffer = Buffer.from(hash, 'base64');
      
      return new Promise((resolve, reject) => {
        crypto.scrypt(password, saltBuffer, 64, (err, derivedKey) => {
          if (err) reject(err);
          resolve(crypto.timingSafeEqual(hashBuffer, derivedKey));
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Маскирование чувствительных данных
   */
  maskSensitiveData(data: string, unmaskedLength: number = 4): string {
    if (!data) return '';
    if (data.length <= unmaskedLength) return '*'.repeat(data.length);
    
    const visiblePart = data.slice(-unmaskedLength);
    return '*'.repeat(data.length - unmaskedLength) + visiblePart;
  }

  /**
   * Генерация безопасного токена
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }
}