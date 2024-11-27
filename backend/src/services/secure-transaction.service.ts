import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from './logger.service';
import { AuditService, AuditActionType, AuditLogLevel } from './audit.service';
import { Transaction } from '../entities/transaction.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed'
}

export enum TransactionType {
  // Финансовые операции
  PAYMENT = 'payment',
  REFUND = 'refund',
  COMMISSION = 'commission',
  BONUS = 'bonus',

  // Изменения статусов
  ORDER_STATUS = 'order_status',
  DRIVER_STATUS = 'driver_status',
  USER_STATUS = 'user_status',

  // Критические операции
  ADMIN_ACTION = 'admin_action',
  SYSTEM_CONFIG = 'system_config',
  DATA_MODIFICATION = 'data_modification'
}

interface TransactionContext {
  userId: string;
  userType: 'client' | 'driver' | 'admin';
  sessionId?: string;
  metadata?: Record<string, any>;
}

interface TransactionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  transactionId: string;
}

@Injectable()
export class SecureTransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private dataSource: DataSource,
    private securityLogger: SecurityLogger,
    private auditService: AuditService,
    private configService: ConfigService
  ) {}

  /**
   * Выполнение безопасной транзакции
   */
  async executeTransaction<T>(
    type: TransactionType,
    context: TransactionContext,
    operation: (entityManager: EntityManager) => Promise<T>
  ): Promise<TransactionResult<T>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let transactionRecord: Transaction;

    try {
      // Создаем запись о транзакции
      transactionRecord = await this.createTransactionRecord(
        type,
        context,
        queryRunner.manager
      );

      // Обновляем статус
      await this.updateTransactionStatus(
        transactionRecord.id,
        TransactionStatus.PROCESSING,
        queryRunner.manager
      );

      // Выполняем операцию
      const result = await operation(queryRunner.manager);

      // Фиксируем успешное выполнение
      await this.updateTransactionStatus(
        transactionRecord.id,
        TransactionStatus.COMPLETED,
        queryRunner.manager,
        { result }
      );

      await queryRunner.commitTransaction();

      // Логируем успешное выполнение
      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.INFO,
        {
          userId: context.userId,
          resourceType: 'transaction',
          resourceId: transactionRecord.id,
          metadata: {
            type,
            result: 'success'
          }
        }
      );

      return {
        success: true,
        result,
        transactionId: transactionRecord.id
      };
    } catch (error) {
      // В случае ошибки откатываем транзакцию
      await queryRunner.rollbackTransaction();

      // Обновляем статус на FAILED
      if (transactionRecord) {
        await this.updateTransactionStatus(
          transactionRecord.id,
          TransactionStatus.FAILED,
          this.transactionRepository.manager,
          { error: error.message }
        );
      }

      // Логируем ошибку
      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Transaction failed',
        userId: context.userId,
        metadata: {
          transactionId: transactionRecord?.id,
          type,
          error: error.message
        }
      });

      return {
        success: false,
        error,
        transactionId: transactionRecord?.id
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Отмена транзакции
   */
  async reverseTransaction(
    transactionId: string,
    context: TransactionContext,
    reverseOperation: (entityManager: EntityManager) => Promise<void>
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await this.transactionRepository.findOne({
        where: { id: transactionId }
      });

      if (!transaction || transaction.status !== TransactionStatus.COMPLETED) {
        throw new Error('Transaction cannot be reversed');
      }

      // Выполняем операцию отмены
      await reverseOperation(queryRunner.manager);

      // Обновляем статус транзакции
      await this.updateTransactionStatus(
        transactionId,
        TransactionStatus.REVERSED,
        queryRunner.manager
      );

      await queryRunner.commitTransaction();

      // Логируем отмену транзакции
      await this.auditService.log(
        AuditActionType.DATA_EXPORT,
        AuditLogLevel.WARNING,
        {
          userId: context.userId,
          resourceType: 'transaction',
          resourceId: transactionId,
          metadata: {
            action: 'reverse',
            originalType: transaction.type
          }
        }
      );

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      this.securityLogger.logSecurityEvent({
        type: 'modification',
        severity: 'high',
        message: 'Transaction reversal failed',
        userId: context.userId,
        metadata: {
          transactionId,
          error: error.message
        }
      });

      return false;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Получение деталей транзакции
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    return this.transactionRepository.findOne({
      where: { id: transactionId }
    });
  }

  /**
   * Получение истории транзакций
   */
  async getTransactionHistory(filters: {
    userId?: string;
    type?: TransactionType[];
    status?: TransactionStatus[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const query = this.transactionRepository.createQueryBuilder('transaction');

    if (filters.userId) {
      query.andWhere('transaction.userId = :userId', { userId: filters.userId });
    }

    if (filters.type?.length) {
      query.andWhere('transaction.type IN (:...types)', { types: filters.type });
    }

    if (filters.status?.length) {
      query.andWhere('transaction.status IN (:...statuses)', { statuses: filters.status });
    }

    if (filters.startDate) {
      query.andWhere('transaction.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('transaction.createdAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    query.orderBy('transaction.createdAt', 'DESC');

    const [transactions, total] = await query.getManyAndCount();
    return { transactions, total };
  }

  private async createTransactionRecord(
    type: TransactionType,
    context: TransactionContext,
    entityManager: EntityManager
  ): Promise<Transaction> {
    const transaction = entityManager.create(Transaction, {
      type,
      userId: context.userId,
      userType: context.userType,
      sessionId: context.sessionId,
      status: TransactionStatus.PENDING,
      metadata: context.metadata,
      createdAt: new Date()
    });

    return entityManager.save(transaction);
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    entityManager: EntityManager,
    additionalData?: Record<string, any>
  ): Promise<void> {
    await entityManager.update(Transaction, transactionId, {
      status,
      metadata: additionalData ? additionalData : undefined,
      updatedAt: new Date()
    });
  }
}