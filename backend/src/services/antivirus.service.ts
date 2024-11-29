import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import * as NodeClam from 'clamscan';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export enum ScanResult {
  CLEAN = 'clean',
  INFECTED = 'infected',
  ERROR = 'error'
}

interface ScanResponse {
  result: ScanResult;
  viruses?: string[];
  error?: string;
}

@Injectable()
export class AntivirusService {
  private clamav: NodeClam;
  private initialized: boolean = false;
  private readonly quarantinePath: string;

  constructor(
    private configService: ConfigService,
    private securityLogger: SecurityLogger,
    private auditService: AuditService
  ) {
    this.quarantinePath = this.configService.get<string>('QUARANTINE_PATH', 'storage/quarantine');
    this.initializeAntivirus();
  }

  private async initializeAntivirus() {
    try {
      this.clamav = new NodeClam().init({
        removeInfected: false,
        quarantineInfected: true,
        scanLog: null,
        debugMode: false,
        fileList: null,
        scanRecursively: true,
        clamscan: {
          path: '/usr/bin/clamscan',
          db: null,
          scanArchives: true,
          maxFileSize: 100 * 1024 * 1024, // 100MB
          maxScanSize: 150 * 1024 * 1024, // 150MB
          virusFound: 'Found virus:',
        },
        preference: 'clamscan'
      });

      // Создаем директорию для карантина
      await fs.promises.mkdir(this.quarantinePath, { recursive: true });
      
      this.initialized = true;

      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'low',
        message: 'Antivirus service initialized successfully'
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'critical',
        message: 'Failed to initialize antivirus service',
        metadata: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Сканирование буфера файла
   */
  async scanBuffer(
    buffer: Buffer,
    fileName: string,
    userId?: string
  ): Promise<ScanResponse> {
    try {
      if (!this.initialized) {
        throw new Error('Antivirus service not initialized');
      }

      // Создаем временный файл
      const tempPath = path.join(this.quarantinePath, `temp_${Date.now()}_${fileName}`);
      await fs.promises.writeFile(tempPath, buffer);

      // Сканируем файл
      const { isInfected, viruses } = await this.clamav.scanFile(tempPath);

      // Удаляем временный файл
      await fs.promises.unlink(tempPath);

      // Если файл заражен
      if (isInfected) {
        await this.handleInfectedFile(buffer, fileName, viruses, userId);
        return {
          result: ScanResult.INFECTED,
          viruses
        };
      }

      // Логируем успешное сканирование
      await this.auditService.log(
        AuditActionType.SECURITY_VIOLATION,
        AuditLogLevel.INFO,
        {
          userId,
          metadata: {
            fileName,
            scanResult: 'clean'
          }
        }
      );

      return { result: ScanResult.CLEAN };

    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Virus scan failed',
        userId,
        metadata: {
          fileName,
          error: error.message
        }
      });

      return {
        result: ScanResult.ERROR,
        error: error.message
      };
    }
  }

  /**
   * Сканирование файла по пути
   */
  async scanFile(
    filePath: string,
    userId?: string
  ): Promise<ScanResponse> {
    try {
      if (!this.initialized) {
        throw new Error('Antivirus service not initialized');
      }

      const { isInfected, viruses } = await this.clamav.scanFile(filePath);

      if (isInfected) {
        const buffer = await fs.promises.readFile(filePath);
        const fileName = path.basename(filePath);
        await this.handleInfectedFile(buffer, fileName, viruses, userId);

        return {
          result: ScanResult.INFECTED,
          viruses
        };
      }

      await this.auditService.log(
        AuditActionType.SECURITY_VIOLATION,
        AuditLogLevel.INFO,
        {
          userId,
          metadata: {
            filePath,
            scanResult: 'clean'
          }
        }
      );

      return { result: ScanResult.CLEAN };

    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Virus scan failed',
        userId,
        metadata: {
          filePath,
          error: error.message
        }
      });

      return {
        result: ScanResult.ERROR,
        error: error.message
      };
    }
  }

  private async handleInfectedFile(
    buffer: Buffer,
    fileName: string,
    viruses: string[],
    userId?: string
  ): Promise<void> {
    try {
      // Помещаем файл в карантин
      const quarantinePath = path.join(
        this.quarantinePath,
        `infected_${Date.now()}_${fileName}`
      );
      await fs.promises.writeFile(quarantinePath, buffer);

      // Логируем инцидент
      await this.auditService.log(
        AuditActionType.SECURITY_VIOLATION,
        AuditLogLevel.CRITICAL,
        {
          userId,
          metadata: {
            fileName,
            viruses,
            quarantinePath
          }
        }
      );

      this.securityLogger.logSecurityEvent({
        type: 'attack',
        severity: 'critical',
        message: 'Infected file detected',
        userId,
        metadata: {
          fileName,
          viruses,
          quarantinePath
        }
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        type: 'error',
        severity: 'high',
        message: 'Failed to handle infected file',
        userId,
        metadata: {
          fileName,
          error: error.message
        }
      });
    }
  }
}