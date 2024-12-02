// src/modules/assignment/assignment.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Driver, DriverStatus, CarClass } from '../../entities/driver.entity';
import { Order, OrderStatus } from '../../entities/order.entity';
import { AssignmentCriteria, AssignmentResult, DriverScore } from './assignment.interface';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>
  ) {}

  async assignDriverToOrder(criteria: AssignmentCriteria): Promise<AssignmentResult> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: criteria.orderId },
        relations: ['driver']
      });

      if (!order || order.status !== OrderStatus.CREATED) {
        return {
          success: false,
          message: 'Order not found or not in valid status'
        };
      }

      const availableDrivers = await this.findAvailableDrivers(
        criteria.carClass,
        criteria.pickupDatetime
      );

      if (!availableDrivers.length) {
        return {
          success: false,
          message: 'No available drivers found'
        };
      }

      const scoredDrivers = this.scoreDrivers(availableDrivers, criteria);
      if (!scoredDrivers.length) {
        return {
          success: false,
          message: 'No suitable drivers found'
        };
      }

      const bestDriver = scoredDrivers[0];
      const updatedOrder = await this.assignDriver(order, bestDriver.driver);

      return {
        success: true,
        order: updatedOrder,
        driver: bestDriver.driver
      };
    } catch (error) {
      this.logger.error(`Failed to assign driver: ${error.message}`);
      return {
        success: false,
        message: 'Failed to assign driver'
      };
    }
  }

  private async findAvailableDrivers(
    carClass: CarClass,
    pickupDatetime: Date
  ): Promise<Driver[]> {
    const busyDriverIds = await this.findBusyDriverIds(pickupDatetime);

    return this.driverRepository.find({
      where: {
        carClass: carClass,
        status: DriverStatus.ONLINE,
        ...(busyDriverIds.length > 0 ? { id: Not(In(busyDriverIds)) } : {})
      },
      relations: ['user']
    });
  }

  private async findBusyDriverIds(pickupDatetime: Date): Promise<string[]> {
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

    return busyOrders
      .filter(order => order.driver)
      .map(order => order.driver.id);
  }

  private scoreDrivers(drivers: Driver[], criteria: AssignmentCriteria): DriverScore[] {
    return drivers
      .map(driver => ({
        driver,
        score: this.calculateScore(driver, criteria)
      }))
      .sort((a, b) => b.score - a.score);
  }

  private calculateScore(driver: Driver, criteria: AssignmentCriteria): number {
    const ratingScore = (driver.rating / 5) * 0.7;
    const experienceScore = Math.min(driver.totalRides / 1000, 1) * 0.3;
    return ratingScore + experienceScore;
  }

  private async assignDriver(order: Order, driver: Driver): Promise<Order> {
    const queryRunner = this.orderRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const isAvailable = await this.checkDriverAvailability(
        driver.id,
        order.pickupDatetime
      );

      if (!isAvailable) {
        throw new Error('Driver is no longer available');
      }

      order.driver = driver;
      order.status = OrderStatus.DRIVER_ASSIGNED;
      const savedOrder = await queryRunner.manager.save(Order, order);

      driver.status = DriverStatus.BUSY;
      await queryRunner.manager.save(Driver, driver);

      await queryRunner.commitTransaction();
      
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
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