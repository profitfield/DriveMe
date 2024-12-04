// src/services/orders.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { Order, OrderStatus, OrderType, PaymentType } from '../entities/order.entity';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { CreateOrderDto } from '../dto/order.dto';
import { PriceService } from './price.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { TransactionService } from './transaction.service';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private priceService: PriceService,
    private driverAssignmentService: DriverAssignmentService,
    private transactionService: TransactionService,
    private notificationQueueService: NotificationQueueService
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
      const priceCalculation = this.priceService.calculatePrice(
        createOrderDto.type,
        createOrderDto.carClass,
        createOrderDto.durationHours,
        this.getAirportCode(createOrderDto.destinationAddress?.address)
      );

      const commission = this.priceService.calculateCommission(priceCalculation.finalPrice);

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

      await this.notificationQueueService.addToQueue({
        type: 'orderStatus',
        payload: {
          order: savedOrder,
          status: OrderStatus.CREATED,
          additionalData: {
            price: priceCalculation.finalPrice,
            paymentType: PaymentType.CASH
          }
        }
      });

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

          await this.notificationQueueService.addToQueue({
            type: 'orderStatus',
            payload: {
              order: savedOrder,
              status: OrderStatus.DRIVER_ASSIGNED,
              additionalData: {
                driverName: driver.user.firstName,
                carInfo: driver.carInfo
              }
            }
          });
        }
      }

      await queryRunner.commitTransaction();
      return this.findById(savedOrder.id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Ошибка создания заказа: ${error.message}`);

      await this.notificationQueueService.addToQueue({
        type: 'system',
        payload: {
          message: `Ошибка создания заказа: ${error.message}`,
          severity: 'error',
          additionalData: { userId }
        }
      });

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

  async findActiveOrdersByDriver(driverId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: {
        driver: { id: driverId },
        status: In([
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

  async getAvailableOrders(): Promise<Order[]> {
    return this.ordersRepository.find({
      where: {
        status: OrderStatus.CREATED,
        driver: IsNull()
      },
      relations: ['client'],
      order: { pickupDatetime: 'ASC' }
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findById(id);
      
      if (!this.isValidStatusTransition(order.status, status)) {
        throw new BadRequestException(
          `Недопустимое изменение статуса с ${order.status} на ${status}`
        );
      }

      order.status = status;
      const additionalData: Record<string, any> = {
        oldStatus: order.status,
        newStatus: status
      };

      if (status === OrderStatus.COMPLETED && order.driver) {
        additionalData.price = order.price;
        additionalData.driverEarnings = order.price - order.commission;
        additionalData.commission = order.commission;

        await this.transactionService.createOrderTransaction(order);
        order.driver.totalRides += 1;
        await queryRunner.manager.save(Driver, order.driver);
      }

      if (status === OrderStatus.EN_ROUTE) {
        additionalData.eta = '15 минут';
      }

      await queryRunner.manager.save(Order, order);

      await this.notificationQueueService.addToQueue({
        type: 'orderStatus',
        payload: {
          order,
          status,
          additionalData
        }
      });

      await queryRunner.commitTransaction();
      return this.findById(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      await this.notificationQueueService.addToQueue({
        type: 'system',
        payload: {
          message: `Ошибка обновления статуса заказа: ${error.message}`,
          severity: 'error',
          additionalData: { orderId: id, status }
        }
      });

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

      if (order.driver) {
        order.driver.status = DriverStatus.ONLINE;
        await queryRunner.manager.save(Driver, order.driver);
      }

      await queryRunner.manager.save(Order, order);

      await this.notificationQueueService.addToQueue({
        type: 'orderStatus',
        payload: {
          order,
          status: OrderStatus.CANCELLED,
          additionalData: { 
            reason,
            originalStatus: order.status
          }
        }
      });

      await queryRunner.commitTransaction();
      return order;

    } catch (error) {
      await queryRunner.rollbackTransaction();

      await this.notificationQueueService.addToQueue({
        type: 'system',
        payload: {
          message: `Ошибка отмены заказа: ${error.message}`,
          severity: 'error',
          additionalData: { orderId: id, reason }
        }
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
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

  async getClientStatistics(clientId: string): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    totalSpent: number;
    activeOrders: number;
  }> {
    const orders = await this.ordersRepository.find({
      where: { client: { id: clientId } }
    });

    return {
      total: orders.length,
      completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
      cancelled: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
      totalSpent: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.price), 0),
      activeOrders: orders.filter(o => 
        [OrderStatus.CREATED, OrderStatus.DRIVER_ASSIGNED, 
         OrderStatus.CONFIRMED, OrderStatus.EN_ROUTE, 
         OrderStatus.ARRIVED, OrderStatus.STARTED].includes(o.status)
      ).length
    };
  }

  async getDriverStatistics(driverId: string): Promise<{
    total: number;
    completed: number;
    totalEarned: number;
    totalCommission: number;
    activeOrders: number;
  }> {
    const orders = await this.ordersRepository.find({
      where: { driver: { id: driverId } }
    });

    return {
      total: orders.length,
      completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
      totalEarned: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.price - order.commission), 0),
      totalCommission: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.commission), 0),
      activeOrders: orders.filter(o => 
        [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CONFIRMED, 
         OrderStatus.EN_ROUTE, OrderStatus.ARRIVED, 
         OrderStatus.STARTED].includes(o.status)
      ).length
    };
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
}