// src/services/orders.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Order, OrderStatus, OrderType, PaymentType } from '../entities/order.entity';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { CreateOrderDto } from '../dto/order.dto';
import { PriceService } from './price.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { TransactionService } from './transaction.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private priceService: PriceService,
    private driverAssignmentService: DriverAssignmentService,
    private transactionService: TransactionService
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    const pickupDatetime = new Date(createOrderDto.pickupDatetime);
    
    if (pickupDatetime < new Date()) {
      throw new BadRequestException('Время подачи не может быть в прошлом');
    }

    const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Расчет стоимости и комиссии
      const priceCalculation = this.priceService.calculatePrice(
        createOrderDto.type,
        createOrderDto.carClass,
        createOrderDto.durationHours,
        this.getAirportCode(createOrderDto.destinationAddress?.address)
      );

      const commission = this.priceService.calculateCommission(priceCalculation.finalPrice);

      // Создаем заказ
      const order = queryRunner.manager.create(Order, {
        ...createOrderDto,
        client: { id: userId },
        price: priceCalculation.finalPrice,
        commission,
        status: OrderStatus.CREATED,
        paymentType: PaymentType.CASH,
        bonusPayment: 0
      });

      const savedOrder = await queryRunner.manager.save(Order, order);

      // Пытаемся найти и назначить водителя
      const driver = await this.driverAssignmentService.findDriverForOrder(savedOrder);
      
      if (driver) {
        const assignmentSuccess = await this.driverAssignmentService.assignDriverToOrder(
          savedOrder.id, 
          driver.id
        );

        if (assignmentSuccess) {
          savedOrder.driver = driver;
          savedOrder.status = OrderStatus.DRIVER_ASSIGNED;
          await queryRunner.manager.save(Order, savedOrder);
        }
      }

      await queryRunner.commitTransaction();
      return this.findById(savedOrder.id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Ошибка создания заказа: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['client', 'driver', 'driver.user']
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    return order;
  }

  async findByClientId(clientId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { client: { id: clientId } },
      relations: ['driver', 'driver.user'],
      order: { createdAt: 'DESC' }
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findById(id);
      
      if (!this.isValidStatusTransition(order.status, status)) {
        throw new BadRequestException(`Недопустимое изменение статуса с ${order.status} на ${status}`);
      }

      order.status = status;

      if (status === OrderStatus.COMPLETED && order.driver) {
        // Создаем транзакцию и обновляем статистику водителя
        await this.transactionService.createOrderTransaction(order);
        
        order.driver.totalRides += 1;
        await queryRunner.manager.save(Driver, order.driver);
      }

      await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      return this.findById(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findById(id);
      
      const cancellableStatuses = [
        OrderStatus.CREATED,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.CONFIRMED
      ];

      if (!cancellableStatuses.includes(order.status)) {
        throw new BadRequestException('Заказ не может быть отменен в текущем статусе');
      }

      order.status = OrderStatus.CANCELLED;
      order.cancellationReason = reason;

      // Если был назначен водитель, освобождаем его
      if (order.driver) {
        order.driver.status = DriverStatus.ONLINE;
        await queryRunner.manager.save(Driver, order.driver);
      }

      await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      return order;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
    const validTransitions = {
      [OrderStatus.CREATED]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED],
      [OrderStatus.DRIVER_ASSIGNED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.EN_ROUTE, OrderStatus.CANCELLED],
      [OrderStatus.EN_ROUTE]: [OrderStatus.ARRIVED],
      [OrderStatus.ARRIVED]: [OrderStatus.STARTED],
      [OrderStatus.STARTED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: []
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  private getAirportCode(address?: string): 'SVO' | 'DME' | 'VKO' | undefined {
    if (!address) return undefined;
    
    const normalizedAddress = address.toLowerCase();
    if (normalizedAddress.includes('шереметьево')) return 'SVO';
    if (normalizedAddress.includes('домодедово')) return 'DME';
    if (normalizedAddress.includes('внуково')) return 'VKO';
    
    return undefined;
  }

  async getActiveOrders(): Promise<Order[]> {
    return this.ordersRepository.find({
      where: {
        status: In([
          OrderStatus.CREATED,
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.CONFIRMED,
          OrderStatus.EN_ROUTE,
          OrderStatus.ARRIVED,
          OrderStatus.STARTED
        ])
      },
      relations: ['client', 'driver', 'driver.user'],
      order: { pickupDatetime: 'ASC' }
    });
  }

  async getUpcomingOrders(userId: string): Promise<Order[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59);

    const now = new Date();

    return this.ordersRepository.find({
      where: {
        client: { id: userId },
        pickupDatetime: Between(now, tomorrow),
        status: In([
          OrderStatus.CREATED,
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.CONFIRMED
        ])
      },
      relations: ['driver', 'driver.user'],
      order: { pickupDatetime: 'ASC' }
    });
  }

  async getAllOrders(): Promise<Order[]> {
    return this.ordersRepository.find({
      relations: ['client', 'driver', 'driver.user'],
      order: { createdAt: 'DESC' }
    });
  }

  async getOrderStatistics(userId: string): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    revenue: number;
  }> {
    const orders = await this.ordersRepository.find({
      where: { client: { id: userId } }
    });

    return {
      total: orders.length,
      completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
      cancelled: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
      revenue: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.price), 0)
    };
  }
}