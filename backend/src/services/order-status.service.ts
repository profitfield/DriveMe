// src/services/order-status.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class OrderStatusService {
    private readonly logger = new Logger(OrderStatusService.name);

    private readonly allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        [OrderStatus.CREATED]: [
            OrderStatus.DRIVER_ASSIGNED,
            OrderStatus.CANCELLED
        ],
        [OrderStatus.DRIVER_ASSIGNED]: [
            OrderStatus.CONFIRMED,
            OrderStatus.CANCELLED
        ],
        [OrderStatus.CONFIRMED]: [
            OrderStatus.EN_ROUTE,
            OrderStatus.CANCELLED
        ],
        [OrderStatus.EN_ROUTE]: [
            OrderStatus.ARRIVED,
            OrderStatus.CANCELLED
        ],
        [OrderStatus.ARRIVED]: [
            OrderStatus.STARTED,
            OrderStatus.CANCELLED
        ],
        [OrderStatus.STARTED]: [
            OrderStatus.COMPLETED,
            OrderStatus.CANCELLED
        ],
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: []
    };

    private readonly requireCancellationReason = [
        OrderStatus.CONFIRMED,
        OrderStatus.EN_ROUTE,
        OrderStatus.ARRIVED,
        OrderStatus.STARTED
    ];

    constructor(
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>,
        @InjectRepository(Driver)
        private readonly driverRepository: Repository<Driver>,
        private readonly notificationQueueService: NotificationQueueService
    ) {}

    async updateOrderStatus(
        orderId: string,
        newStatus: OrderStatus,
        metadata?: Record<string, any>
    ): Promise<Order> {
        const queryRunner = this.orderRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const order = await this.orderRepository.findOne({
                where: { id: orderId },
                relations: ['driver', 'driver.user', 'client']
            });

            if (!order) {
                throw new BadRequestException(`Order ${orderId} not found`);
            }

            if (newStatus === OrderStatus.CANCELLED) {
                this.validateCancellation(order, metadata);
            }

            if (!this.canTransitionTo(order.status, newStatus)) {
                throw new BadRequestException(
                    `Cannot transition from ${order.status} to ${newStatus}`
                );
            }

            this.updateStatusTimestamp(order, newStatus);

            await this.handleStatusSpecificLogic(
                queryRunner,
                order,
                newStatus,
                metadata
            );

            order.status = newStatus;
            
            if (metadata?.rating) {
                await this.handleRating(order, metadata.rating, metadata.comment);
            }

            const savedOrder = await queryRunner.manager.save(Order, order);

            await this.sendStatusNotifications(savedOrder, newStatus, metadata);

            await queryRunner.commitTransaction();
            
            this.logger.log(`Order ${orderId} status updated to ${newStatus}`);

            return savedOrder;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                `Failed to update order ${orderId} status: ${error.message}`,
                error.stack
            );
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private async handleStatusSpecificLogic(
        queryRunner: any,
        order: Order,
        newStatus: OrderStatus,
        metadata?: Record<string, any>
    ): Promise<void> {
        switch (newStatus) {
            case OrderStatus.DRIVER_ASSIGNED:
                await this.handleDriverAssignment(queryRunner, order);
                break;

            case OrderStatus.EN_ROUTE:
                await this.handleEnRoute(queryRunner, order);
                break;

            case OrderStatus.COMPLETED:
                await this.handleOrderCompletion(queryRunner, order, metadata);
                break;

            case OrderStatus.CANCELLED:
                await this.handleOrderCancellation(queryRunner, order, metadata);
                break;
        }
    }

    private async handleDriverAssignment(
        queryRunner: any,
        order: Order
    ): Promise<void> {
        if (!order.driver) {
            throw new BadRequestException('No driver assigned to order');
        }

        await queryRunner.manager.update(
            Driver,
            { id: order.driver.id },
            { status: DriverStatus.BUSY }
        );
    }

    private async handleEnRoute(
        queryRunner: any,
        order: Order
    ): Promise<void> {
        if (!order.driver) {
            throw new BadRequestException('No driver assigned to order');
        }

        order.startLocation = await this.getCurrentDriverLocation(order.driver.id);
        order.estimatedArrivalTime = await this.calculateEstimatedArrivalTime(order);
    }

    private async handleOrderCompletion(
        queryRunner: any,
        order: Order,
        metadata?: Record<string, any>
    ): Promise<void> {
        if (!order.driver) {
            throw new BadRequestException('No driver assigned to order');
        }

        // Обновляем статус водителя
        await queryRunner.manager.update(
            Driver,
            { id: order.driver.id },
            { 
                status: DriverStatus.ONLINE,
                totalRides: () => '"totalRides" + 1'
            }
        );

        // Фиксируем конечную стоимость
        order.actualPrice = order.estimatedPrice;

        // Если есть дополнительные расходы
        if (metadata?.additionalCharges) {
            order.actualPrice += metadata.additionalCharges;
        }

        order.completedAt = new Date();
    }

    private async handleOrderCancellation(
        queryRunner: any,
        order: Order,
        metadata?: Record<string, any>
    ): Promise<void> {
        if (metadata?.reason) {
            order.cancellationReason = metadata.reason;
        }

        if (order.driver) {
            await queryRunner.manager.update(
                Driver,
                { id: order.driver.id },
                { status: DriverStatus.ONLINE }
            );
        }

        order.cancelledAt = new Date();
    }

    private async handleRating(
        order: Order, 
        rating: number, 
        comment?: string
    ): Promise<void> {
        if (rating < 1 || rating > 5) {
            throw new BadRequestException('Rating must be between 1 and 5');
        }

        order.rating = rating;
        order.ratingComment = comment;

        if (order.driver) {
            const driver = await this.driverRepository.findOne({
                where: { id: order.driver.id }
            });

            if (driver) {
                const totalRides = driver.totalRides + 1;
                const newRating = ((driver.rating * driver.totalRides) + rating) / totalRides;
                
                await this.driverRepository.update(driver.id, {
                    rating: Number(newRating.toFixed(2))
                });
            }
        }
    }

    private async sendStatusNotifications(
        order: Order,
        newStatus: OrderStatus,
        metadata?: Record<string, any>
    ): Promise<void> {
        const notificationData = this.prepareNotificationData(order, newStatus, metadata);
        
        await this.notificationQueueService.addToQueue({
            type: 'orderStatus',
            payload: {
                order,
                status: newStatus,
                additionalData: notificationData
            }
        });
    }

    private prepareNotificationData(
        order: Order,
        status: OrderStatus,
        metadata?: Record<string, any>
    ): Record<string, any> {
        const baseData = {
            orderId: order.id,
            status,
            ...metadata
        };

        switch (status) {
            case OrderStatus.EN_ROUTE:
                return {
                    ...baseData,
                    estimatedArrivalTime: order.estimatedArrivalTime
                };

            case OrderStatus.COMPLETED:
                return {
                    ...baseData,
                    finalPrice: order.actualPrice,
                    rating: order.rating
                };

            case OrderStatus.CANCELLED:
                return {
                    ...baseData,
                    reason: order.cancellationReason,
                    originalStatus: metadata?.originalStatus
                };

            default:
                return baseData;
        }
    }

    private canTransitionTo(
        currentStatus: OrderStatus,
        newStatus: OrderStatus
    ): boolean {
        const allowedNextStatuses = this.allowedTransitions[currentStatus];
        return allowedNextStatuses.includes(newStatus);
    }

    private validateCancellation(order: Order, metadata?: Record<string, any>): void {
        if (this.requireCancellationReason.includes(order.status) && !metadata?.reason) {
            throw new BadRequestException('Cancellation reason is required');
        }
    }

    private updateStatusTimestamp(order: Order, status: OrderStatus): void {
        const now = new Date();
        switch (status) {
            case OrderStatus.CONFIRMED:
                order.confirmedAt = now;
                break;
            case OrderStatus.STARTED:
                order.startedAt = now;
                break;
            case OrderStatus.COMPLETED:
                order.completedAt = now;
                break;
            case OrderStatus.CANCELLED:
                order.cancelledAt = now;
                break;
        }
    }

    private async getCurrentDriverLocation(driverId: string): Promise<{ latitude: number; longitude: number } | null> {
        // В реальном приложении здесь будет интеграция с сервисом геолокации
        return null;
    }

    private async calculateEstimatedArrivalTime(order: Order): Promise<Date> {
        // В реальном приложении здесь будет интеграция с сервисом маршрутизации
        const estimatedMinutes = 15;
        const arrivalTime = new Date();
        arrivalTime.setMinutes(arrivalTime.getMinutes() + estimatedMinutes);
        return arrivalTime;
    }
}