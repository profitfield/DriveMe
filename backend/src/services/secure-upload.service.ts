import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { EncryptionService } from './encryption.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { AntivirusService, ScanResult } from './antivirus.service';
import { FileUpload, FileStatus } from '../entities/file-upload.entity';
import { FileTypeResult, fileTypeFromBuffer } from 'file-type';
import sanitize from 'sanitize-filename';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Multer } from 'multer';

interface FileValidationRules {
  maxSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  scanForMalware: boolean;
}

const FILE_VALIDATION_RULES: Record<string, FileValidationRules> = {
  documents: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions: ['.pdf', '.doc', '.docx'],
    scanForMalware: true
  },
  images: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    scanForMalware: true
  },
  avatars: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    scanForMalware: true
  }
};

@Injectable()
export class SecureUploadService {
  constructor(
    @InjectRepository(FileUpload)
    private fileRepository: Repository<FileUpload>,
    private securityLogger: SecurityLogger,
    private encryptionService: EncryptionService,
    private auditService: AuditService,
    private configService: ConfigService,
    private antivirusService: AntivirusService
  ) {
    this.initializeUploadDirectories();
  }

  /**
   * Безопасная загрузка файла
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    category: string,
    metadata?: Record<string, any>
  ): Promise<FileUpload> {
    try {
      // Валидация файла
      await this.validateFile(file, category);

      // Создаем безопасное имя файла
      const secureFilename = this.generateSecureFilename(file.originalname);

      // Проверяем содержимое файла
      await this.analyzeFileContent(file);

      // Вычисляем хеш файла
      const checksum = this.calculateChecksum(file.buffer);

      // Проверяем на дубликаты
      await this.checkForDuplicates(checksum);

      // Шифруем файл
      const encryptedBuffer = await this.encryptFileBuffer(file.buffer);

      // Сохраняем файл
      const uploadPath = path.join(this.getUploadPath(category), secureFilename);
      await fs.writeFile(uploadPath, encryptedBuffer);

      // Создаем запись в БД
      const fileUpload = this.fileRepository.create({
        userId,
        category,
        originalName: file.originalname,
        filename: secureFilename,
        mimeType: file.mimetype,
        size: file.size,
        checksum,
        metadata: metadata || {},
        path: uploadPath,
        scanStatus: FileStatus.CLEAN,
        scanResult: {
          timestamp: new Date(),
          viruses: []
        }
      });

      const savedFile = await this.fileRepository.save(fileUpload);

      // Логируем успешную загрузку
      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.INFO,
        {
          userId,
          resourceType: 'file',
          resourceId: savedFile.id,
          metadata: {
            filename: secureFilename,
            category,
            size: file.size,
            scanStatus: FileStatus.CLEAN
          }
        }
      );

      return savedFile;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'File upload failed',
        userId,
        metadata: {
          filename: file.originalname,
          error: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Получение файла
   */
  async getFile(fileId: string, userId: string): Promise<{ buffer: Buffer; metadata: FileUpload }> {
    try {
      const file = await this.fileRepository.findOne({
        where: { id: fileId }
      });

      if (!file) {
        throw new BadRequestException('File not found');
      }

      if (file.scanStatus !== FileStatus.CLEAN) {
        throw new BadRequestException('File is not safe to download');
      }

      // Проверяем права доступа
      await this.validateFileAccess(file, userId);

      // Читаем и расшифровываем файл
      const encryptedBuffer = await fs.readFile(file.path);
      const buffer = await this.decryptFileBuffer(encryptedBuffer);

      // Проверяем целостность
      const checksum = this.calculateChecksum(buffer);
      if (checksum !== file.checksum) {
        throw new BadRequestException('File integrity check failed');
      }

      // Логируем доступ
      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.INFO,
        {
          userId,
          resourceType: 'file',
          resourceId: fileId,
          metadata: {
            filename: file.filename,
            category: file.category
          }
        }
      );

      return { buffer, metadata: file };
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'medium',
        message: 'File access failed',
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
   * Удаление файла
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const file = await this.fileRepository.findOne({
        where: { id: fileId }
      });

      if (!file) {
        throw new BadRequestException('File not found');
      }

      // Проверяем права доступа
      await this.validateFileAccess(file, userId);

      // Безопасно удаляем файл
      await this.secureDeleteFile(file.path);

      // Удаляем запись из БД
      await this.fileRepository.remove(file);

      // Логируем удаление
      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.WARNING,
        {
          userId,
          resourceType: 'file',
          resourceId: fileId,
          metadata: {
            filename: file.filename,
            category: file.category
          }
        }
      );
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'File deletion failed',
        userId,
        metadata: {
          fileId,
          error: error.message
        }
      });
      throw error;
    }
  }

  private async validateFile(file: Express.Multer.File, category: string): Promise<void> {
    const rules = FILE_VALIDATION_RULES[category];
    if (!rules) {
      throw new BadRequestException('Invalid file category');
    }

    // Проверка размера
    if (file.size > rules.maxSize) {
      throw new BadRequestException('File size exceeds maximum allowed size');
    }

    // Проверка MIME типа
    if (!rules.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Проверка расширения
    const ext = path.extname(file.originalname).toLowerCase();
    if (!rules.allowedExtensions.includes(ext)) {
      throw new BadRequestException('File extension not allowed');
    }

    // Проверка реального типа файла
    const fileTypeResult = await fileTypeFromBuffer(file.buffer);
    if (!fileTypeResult || !rules.allowedMimeTypes.includes(fileTypeResult.mime)) {
      throw new BadRequestException('File content does not match its extension');
    }
  }

  private async analyzeFileContent(file: Express.Multer.File): Promise<void> {
    // Антивирусная проверка
    const scanResult = await this.antivirusService.scanBuffer(
      file.buffer,
      file.originalname
    );

    if (scanResult.result === ScanResult.INFECTED) {
      await this.auditService.log(
        AuditActionType.SECURITY_VIOLATION,
        AuditLogLevel.CRITICAL,
        {
          metadata: {
            filename: file.originalname,
            viruses: scanResult.viruses
          }
        }
      );
      throw new BadRequestException('File contains malware');
    }

    if (scanResult.result === ScanResult.ERROR) {
      throw new BadRequestException('File analysis failed');
    }

    // Дополнительные проверки для разных типов файлов
    if (file.mimetype.startsWith('image/')) {
      await this.validateImage(file.buffer);
    } else if (file.mimetype === 'application/pdf') {
      await this.validatePDF(file.buffer);
    }
  }

  private async validateImage(buffer: Buffer): Promise<void> {
    try {
      // Проверка метаданных изображения
      // TODO: Реализовать проверку метаданных изображения
      // Например, использовать sharp для проверки размеров и формата
      
    } catch (error) {
      throw new BadRequestException('Invalid image file');
    }
  }

  private async validatePDF(buffer: Buffer): Promise<void> {
    try {
      // Проверка на активное содержимое
      const content = buffer.toString();
      if (content.includes('/JS') || 
          content.includes('/JavaScript') || 
          content.includes('/Action') ||
          content.includes('/Launch')) {
        throw new BadRequestException('PDF contains forbidden active content');
      }
      
    } catch (error) {
      throw new BadRequestException('Invalid PDF file');
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async checkForDuplicates(checksum: string): Promise<void> {
    const duplicate = await this.fileRepository.findOne({
      where: { checksum }
    });

    if (duplicate) {
      throw new BadRequestException('File already exists');
    }
  }

  private async encryptFileBuffer(buffer: Buffer): Promise<Buffer> {
    const encrypted = await this.encryptionService.encrypt(buffer.toString('base64'));
    return Buffer.from(encrypted, 'utf8');
  }

  private async decryptFileBuffer(buffer: Buffer): Promise<Buffer> {
    const decrypted = await this.encryptionService.decrypt(buffer.toString('utf8'));
    return Buffer.from(decrypted, 'base64');
  }

  private generateSecureFilename(originalname: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(originalname);
    return `${timestamp}-${random}${ext}`;
  }

  private getUploadPath(category: string): string {
    return path.join(
      this.configService.get<string>('UPLOAD_PATH', 'uploads'),
      category
    );
  }

  private async initializeUploadDirectories(): Promise<void> {
    try {
      const basePath = this.configService.get<string>('UPLOAD_PATH', 'uploads');
      
      // Создаем основную директорию и поддиректории для категорий
      await fs.mkdir(basePath, { recursive: true });
      
      for (const category of Object.keys(FILE_VALIDATION_RULES)) {
        await fs.mkdir(path.join(basePath, category), { recursive: true });
      }

      // Создаем директорию для карантина
      const quarantinePath = this.configService.get<string>('QUARANTINE_PATH', 'quarantine');
      await fs.mkdir(quarantinePath, { recursive: true });

      // Устанавливаем правильные права доступа
      await fs.chmod(basePath, 0o750);
      await fs.chmod(quarantinePath, 0o750);
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'critical',
        message: 'Failed to initialize upload directories',
        metadata: { error: error.message }
      });
      throw error;
    }
  }

  private async secureDeleteFile(filePath: string): Promise<void> {
    try {
      // Перезаписываем файл случайными данными
      const fileSize = (await fs.stat(filePath)).size;
      const randomData = Buffer.alloc(fileSize, 0);
      await fs.writeFile(filePath, randomData);
      
      // Удаляем файл
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to securely delete file: ${error.message}`);
    }
  }

  private async validateFileAccess(file: FileUpload, userId: string): Promise<void> {
    if (file.userId !== userId) {
      this.securityLogger.logSecurityEvent({
        type: 'access',
        severity: 'high',
        message: 'Unauthorized file access attempt',
        userId,
        metadata: {
          fileId: file.id,
          fileOwner: file.userId
        }
      });
      throw new BadRequestException('Access denied');
    }
  }
}