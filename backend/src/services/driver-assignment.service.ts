import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Driver, DriverStatus, CarClass } from '../entities/driver.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { DriversService } from './drivers.service';
import { OrdersService } from './orders.service';

interface DriverScore {
  driver: Driver;
  score: number;
}

@Injectable()
export class DriverAssignmentService {
  private readonly logger = new Logger(DriverAssignmentService.name);

  constructor(
    private readonly driversService: DriversService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>
  ) {}

  async assignDriverToOrder(orderId: string): Promise<Order | null> {
    const order = await this.ordersService.findById(orderId);
    if (!order || order.status !== OrderStatus.CREATED) {
      return null;
    }

    // Проверяем, нет ли у водителей других заказов на это время
    const availableDrivers = await this.findAvailableDriversForTime(
      order.carClass,
      order.pickupDatetime
    );

    if (!availableDrivers.length) {
      this.logger.warn(`No available drivers found for order ${orderId}`);
      return null;
    }

    const scoredDrivers = this.scoreDrivers(availableDrivers);
    if (!scoredDrivers.length) {
      return null;
    }

    // Выбираем водителя с наивысшим рейтингом
    const bestDriver = scoredDrivers[0];
    return this.assignDriver(order, bestDriver.driver);
  }

  private async findAvailableDriversForTime(
    carClass: CarClass,
    pickupDatetime: Date
  ): Promise<Driver[]> {
    // Находим ID занятых водителей
    const busyOrders = await this.orderRepository.find({
      where: {
        pickupDatetime,
        status: In([
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.CONFIRMED,
          OrderStatus.EN_ROUTE,
          OrderStatus.ARRIVED,
          OrderStatus.STARTED
        ])
      },
      relations: ['driver']
    });

    const busyDriverIds = busyOrders
      .filter(order => order.driver)
      .map(order => order.driver.id);

    // Ищем свободных водителей
    return this.driverRepository.find({
      where: {
        carClass,
        status: DriverStatus.ONLINE,
        id: busyDriverIds.length > 0 ? Not(In(busyDriverIds)) : undefined
      },
      relations: ['user']
    });
  }

  private scoreDrivers(drivers: Driver[]): DriverScore[] {
    const scoredDrivers = drivers.map(driver => ({
      driver,
      score: this.calculateScore(driver)
    }));

    // Сортируем водителей по рейтингу (от высшего к низшему)
    return scoredDrivers.sort((a, b) => b.score - a.score);
  }

  private calculateScore(driver: Driver): number {
    // Формула расчета рейтинга:
    // (Рейтинг водителя * 0.7) + (Количество поездок * 0.3)
    const ratingScore = (driver.rating / 5) * 0.7;
    const experienceScore = Math.min(driver.totalRides / 1000, 1) * 0.3;

    return ratingScore + experienceScore;
  }

  private async assignDriver(order: Order, driver: Driver): Promise<Order> {
    const queryRunner = this.orderRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Проверяем еще раз доступность водителя
      const isAvailable = await this.checkDriverAvailability(
        driver.id,
        order.pickupDatetime
      );

      if (!isAvailable) {
        throw new Error('Driver is no longer available for this time');
      }

      // Обновляем заказ
      order.driver = driver;
      order.status = OrderStatus.DRIVER_ASSIGNED;
      const savedOrder = await queryRunner.manager.save(Order, order);

      await queryRunner.commitTransaction();
      
      this.logger.log(`Driver ${driver.id} assigned to order ${order.id}`);
      
      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to assign driver to order: ${err.message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async checkDriverAvailability(
    driverId: string,
    pickupDatetime: Date
  ): Promise<boolean> {
    const existingOrder = await this.orderRepository.findOne({
      where: {
        driver: { id: driverId },
        pickupDatetime,
        status: In([
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.CONFIRMED,
          OrderStatus.EN_ROUTE,
          OrderStatus.ARRIVED,
          OrderStatus.STARTED
        ])
      }
    });

    return !existingOrder;
  }
}