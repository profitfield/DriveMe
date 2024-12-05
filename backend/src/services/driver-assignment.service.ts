// backend/src/services/driver-assignment.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Driver, DriverStatus, CarClass } from '../entities/driver.entity';
import { Order, OrderStatus } from '../entities/order.entity';

export interface DriverScore {
   driver: Driver;
   score: number;
}

export interface AssignmentCriteria {
   orderId: string;
   carClass: CarClass;
   pickupDatetime: Date;
   location: {
       latitude: number;
       longitude: number;
   };
}

export interface AssignmentResult {
   success: boolean;
   order?: Order;
   driver?: Driver;
   message?: string;
}

@Injectable()
export class DriverAssignmentService {
   private readonly logger = new Logger(DriverAssignmentService.name);

   constructor(
       @InjectRepository(Driver)
       private readonly driverRepository: Repository<Driver>,
       @InjectRepository(Order)
       private readonly orderRepository: Repository<Order>
   ) {}

   async findDriverForOrder(order: Order): Promise<Driver | null> {
       try {
           // Находим доступных водителей подходящего класса
           const availableDrivers = await this.driverRepository.find({
               where: {
                   carClass: order.carClass,
                   status: DriverStatus.ONLINE
               },
               relations: ['user']
           });

           if (!availableDrivers.length) {
               this.logger.warn(`No available drivers found for order ${order.id}`);
               return null;
           }

           // Фильтруем водителей с активными заказами
           const driversWithOrders = await this.findDriversWithActiveOrders();
           const availableDriverIds = availableDrivers
               .map(driver => driver.id)
               .filter(id => !driversWithOrders.includes(id));

           if (!availableDriverIds.length) {
               this.logger.warn(`All drivers are busy for order ${order.id}`);
               return null;
           }

           // Для MVP просто берем первого доступного водителя
           // В будущем здесь будет более сложная логика распределения
           const selectedDriver = availableDrivers.find(
               driver => availableDriverIds.includes(driver.id)
           );

           return selectedDriver || null;

       } catch (error) {
           this.logger.error(`Error finding driver for order ${order.id}: ${error.message}`);
           return null;
       }
   }

   private async findDriversWithActiveOrders(): Promise<string[]> {
       const activeOrders = await this.orderRepository.find({
           where: {
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

       return activeOrders
           .filter(order => order.driver)
           .map(order => order.driver.id);
   }

   async assignDriverToOrder(orderId: string, driverId: string): Promise<boolean> {
       try {
           const order = await this.orderRepository.findOne({
               where: { id: orderId },
               relations: ['driver']
           });

           if (!order || order.status !== OrderStatus.CREATED) {
               this.logger.warn(`Invalid order state for assignment: ${orderId}`);
               return false;
           }

           const driver = await this.driverRepository.findOne({
               where: { id: driverId }
           });

           if (!driver || driver.status !== DriverStatus.ONLINE) {
               this.logger.warn(`Invalid driver state for assignment: ${driverId}`);
               return false;
           }

           // Обновляем заказ и статус водителя в одной транзакции
           await this.orderRepository.manager.transaction(async transactionalEntityManager => {
               // Обновляем заказ
               order.driver = driver;
               order.status = OrderStatus.DRIVER_ASSIGNED;
               await transactionalEntityManager.save(Order, order);

               // Обновляем статус водителя
               driver.status = DriverStatus.BUSY;
               await transactionalEntityManager.save(Driver, driver);
           });

           this.logger.log(`Successfully assigned driver ${driverId} to order ${orderId}`);
           return true;
       } catch (error) {
           this.logger.error(
               `Error assigning driver ${driverId} to order ${orderId}: ${error.message}`
           );
           return false;
       }
   }
}