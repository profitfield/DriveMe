// src/services/transaction.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Order } from '../entities/order.entity';
import { Driver } from '../entities/driver.entity';

@Injectable()
export class TransactionService {
    private readonly logger = new Logger(TransactionService.name);

    constructor(
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>,
        @InjectRepository(Driver)
        private driverRepository: Repository<Driver>
    ) {}

    async createOrderTransaction(order: Order): Promise<Transaction> {
        const queryRunner = this.transactionRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Создаем транзакцию оплаты
            const transaction = this.transactionRepository.create({
                order: { id: order.id },
                driver: order.driver ? { id: order.driver.id } : null,
                type: TransactionType.PAYMENT,
                status: TransactionStatus.COMPLETED,
                amount: order.actualPrice || order.estimatedPrice, // Исправлено: используем actualPrice или estimatedPrice
                commission: order.commission
            });

            await queryRunner.manager.save(Transaction, transaction);

            // Обновляем баланс комиссии водителя
            if (order.driver) {
                order.driver.commissionBalance += order.commission;
                await queryRunner.manager.save(Driver, order.driver);
            }

            await queryRunner.commitTransaction();
            return transaction;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to create transaction for order ${order.id}: ${error.message}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

  async getDriverBalance(driverId: string): Promise<{
    totalEarnings: number;
    commissionBalance: number;
    pendingPayments: number;
  }> {
    const driver = await this.driverRepository.findOneBy({ id: driverId });
    
    const transactions = await this.transactionRepository.find({
      where: {
        driver: { id: driverId },
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED
      }
    });

    const totalEarnings = transactions.reduce(
      (sum, t) => sum + (t.amount - t.commission),
      0
    );

    return {
      totalEarnings,
      commissionBalance: driver.commissionBalance,
      pendingPayments: 0 // Для MVP все платежи считаются мгновенными
    };
  }

  async getTransactionHistory(
    driverId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: {
        driver: { id: driverId }
      },
      order: {
        createdAt: 'DESC'
      },
      take: limit,
      skip: offset,
      relations: ['order']
    });

    return { transactions, total };
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: {
        createdAt: Between(startDate, endDate)
      },
      relations: ['order', 'driver']
    });
  }

  async updateDriverCommissionBalance(driverId: string, amount: number): Promise<void> {
    const queryRunner = this.transactionRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await this.driverRepository.findOneBy({ id: driverId });
      if (driver) {
        driver.commissionBalance += amount;
        await queryRunner.manager.save(Driver, driver);

        const transaction = this.transactionRepository.create({
          driver: { id: driverId },
          type: TransactionType.COMMISSION,
          status: TransactionStatus.COMPLETED,
          amount: amount,
          commission: 0
        });

        await queryRunner.manager.save(Transaction, transaction);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update driver balance: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getDailyTransactions(date: Date = new Date()): Promise<{
    totalAmount: number;
    totalCommission: number;
    transactionCount: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.findByDateRange(startOfDay, endOfDay);

    return {
      totalAmount: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
      totalCommission: transactions.reduce((sum, t) => sum + Number(t.commission), 0),
      transactionCount: transactions.length
    };
  }
}