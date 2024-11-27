import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SecurityLogger } from './logger.service';
import { EncryptionService } from './encryption.service';

interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  encryptionIv: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SecureFileStorageService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly storageDir: string;
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain'
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly securityLogger: SecurityLogger,
    private readonly encryptionService: EncryptionService
  ) {
    this.storageDir = this.configService.get<string>('SECURE_FILES_PATH', 'secure-storage');
    this.initStorage();
  }

  private async initStorage() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Создаем директории для разных типов файлов
      await Promise.all([
        fs.mkdir(join(this.storageDir, 'documents'), { recursive: true }),
        fs.mkdir(join(this.storageDir, 'images'), { recursive: true }),
        fs.mkdir(join(this.storageDir, 'temp'), { recursive: true })
      ]);

      // Устанавливаем правильные права доступа
      await fs.chmod(this.storageDir, 0o750);
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Failed to initialize secure storage',
        metadata: { error: error.message }
      });
      throw new Error('Failed to initialize secure storage');
    }
  }

  /**
   * Безопасное сохранение файла
   */
  async saveFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string
  ): Promise<string> {
    try {
      // Валидация файла
      this.validateFile(buffer, mimeType);

      // Генерируем уникальный ID файла
      const fileId = this.generateFileId();
      const fileDir = this.getFileDirectory(mimeType);
      const filePath = join(fileDir, fileId);

      // Создаем метаданные
      const metadata: FileMetadata = {
        originalName,
        mimeType,
        size: buffer.length,
        checksum: this.calculateChecksum(buffer),
        encryptionIv: randomBytes(12).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Шифруем файл
      const encryptedBuffer = await this.encryptBuffer(
        buffer,
        Buffer.from(metadata.encryptionIv, 'hex')
      );

      // Сохраняем зашифрованный файл и метаданные
      await Promise.all([
        fs.writeFile(filePath, encryptedBuffer),
        fs.writeFile(`${filePath}.meta`, JSON.stringify(metadata))
      ]);

      // Устанавливаем права доступа
      await fs.chmod(filePath, 0o440);
      await fs.chmod(`${filePath}.meta`, 0o440);

      // Логируем операцию
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'low',
        message: 'File securely stored',
        userId,
        metadata: {
          fileId,
          originalName,
          mimeType,
          size: buffer.length
        }
      });

      return fileId;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Failed to store file securely',
        userId,
        metadata: {
          error: error.message,
          originalName,
          mimeType
        }
      });
      throw error;
    }
  }

  /**
   * Безопасное получение файла
   */
  async getFile(fileId: string, userId: string): Promise<{ buffer: Buffer; metadata: FileMetadata }> {
    try {
      const fileDir = await this.findFileDirectory(fileId);
      const filePath = join(fileDir, fileId);

      // Проверяем существование файла
      await fs.access(filePath);
      await fs.access(`${filePath}.meta`);

      // Читаем метаданные
      const metadata: FileMetadata = JSON.parse(
        await fs.readFile(`${filePath}.meta`, 'utf8')
      );

      // Читаем и расшифровываем файл
      const encryptedBuffer = await fs.readFile(filePath);
      const buffer = await this.decryptBuffer(
        encryptedBuffer,
        Buffer.from(metadata.encryptionIv, 'hex')
      );

      // Проверяем целостность
      const checksum = this.calculateChecksum(buffer);
      if (checksum !== metadata.checksum) {
        throw new Error('File integrity check failed');
      }

      // Логируем доступ
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'low',
        message: 'File accessed',
        userId,
        metadata: {
          fileId,
          originalName: metadata.originalName
        }
      });

      return { buffer, metadata };
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'medium',
        message: 'Failed to access file',
        userId,
        metadata: {
          fileId,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Безопасное удаление файла
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const fileDir = await this.findFileDirectory(fileId);
      const filePath = join(fileDir, fileId);

      // Перезаписываем файл случайными данными перед удалением
      await this.secureDelete(filePath);
      await this.secureDelete(`${filePath}.meta`);

      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'medium',
        message: 'File securely deleted',
        userId,
        metadata: { fileId }
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Failed to delete file securely',
        userId,
        metadata: {
          fileId,
          error: error.message
        }
      });
      throw error;
    }
  }

  private validateFile(buffer: Buffer, mimeType: string) {
    // Проверка размера
    if (buffer.length > this.maxFileSize) {
      throw new Error('File size exceeds maximum allowed size');
    }

    // Проверка типа файла
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new Error('File type not allowed');
    }

    // Дополнительные проверки магических чисел для типов файлов
    this.validateFileSignature(buffer, mimeType);
  }

  private validateFileSignature(buffer: Buffer, mimeType: string) {
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'application/pdf': [0x25, 0x50, 0x44, 0x46]
    };

    const signature = signatures[mimeType];
    if (signature) {
      const fileSignature = [...buffer.slice(0, signature.length)];
      if (!fileSignature.every((byte, i) => byte === signature[i])) {
        throw new Error('Invalid file signature');
      }
    }
  }

  private async encryptBuffer(buffer: Buffer, iv: Buffer): Promise<Buffer> {
    const key = await this.getEncryptionKey();
    const cipher = createCipheriv(this.algorithm, key, iv);
    return Buffer.concat([cipher.update(buffer), cipher.final()]);
  }

  private async decryptBuffer(buffer: Buffer, iv: Buffer): Promise<Buffer> {
    const key = await this.getEncryptionKey();
    const decipher = createDecipheriv(this.algorithm, key, iv);
    return Buffer.concat([decipher.update(buffer), decipher.final()]);
  }

  private async secureDelete(filePath: string) {
    try {
      const size = (await fs.stat(filePath)).size;
      const randomData = randomBytes(size);
      await fs.writeFile(filePath, randomData);
      await fs.unlink(filePath);
    } catch (error) {
      // Игнорируем ошибку, если файл уже не существует
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private generateFileId(): string {
    return `${Date.now()}-${randomBytes(16).toString('hex')}`;
  }

  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private getFileDirectory(mimeType: string): string {
    const type = mimeType.split('/')[0];
    switch (type) {
      case 'image':
        return join(this.storageDir, 'images');
      case 'application':
      case 'text':
        return join(this.storageDir, 'documents');
      default:
        return join(this.storageDir, 'temp');
    }
  }

  private async findFileDirectory(fileId: string): Promise<string> {
    // Ищем файл в каждой директории
    const directories = ['documents', 'images', 'temp'];
    
    for (const dir of directories) {
      const path = join(this.storageDir, dir, fileId);
      try {
        await fs.access(path);
        return join(this.storageDir, dir);
      } catch {
        continue;
      }
    }
    
    throw new Error('File not found');
  }

  private async getEncryptionKey(): Promise<Buffer> {
    const key = this.configService.get<string>('FILE_ENCRYPTION_KEY');
    return createHash('sha256').update(key).digest();
  }
}