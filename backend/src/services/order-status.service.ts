import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class OrderStatusService {
    private readonly logger = new Logger(OrderStatusService.name);

    // Карта разрешенных переходов между статусами
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
            OrderStatus.ARRIVED
        ],
        [OrderStatus.ARRIVED]: [
            OrderStatus.STARTED
        ],
        [OrderStatus.STARTED]: [
            OrderStatus.COMPLETED
        ],
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: []
    };

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
                relations: ['driver', 'client']
            });

            if (!order) {
                throw new BadRequestException(`Order ${orderId} not found`);
            }

            // Проверяем возможность перехода в новый статус
            if (!this.canTransitionTo(order.status, newStatus)) {
                throw new BadRequestException(
                    `Cannot transition from ${order.status} to ${newStatus}`
                );
            }

            // Обработка специфической логики для каждого статуса
            await this.handleStatusSpecificLogic(
                queryRunner,
                order,
                newStatus,
                metadata
            );

            // Обновляем статус заказа
            order.status = newStatus;
            await queryRunner.manager.save(Order, order);

            // Отправляем уведомления
            await this.sendStatusNotifications(order, newStatus, metadata);

            await queryRunner.commitTransaction();
            
            this.logger.log(
                `Order ${orderId} status updated to ${newStatus}`
            );

            return order;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                `Failed to update order ${orderId} status: ${error.message}`
            );
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private canTransitionTo(
        currentStatus: OrderStatus,
        newStatus: OrderStatus
    ): boolean {
        const allowedNextStatuses = this.allowedTransitions[currentStatus];
        return allowedNextStatuses.includes(newStatus);
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

            case OrderStatus.COMPLETED:
                await this.handleOrderCompletion(queryRunner, order);
                break;

            case OrderStatus.CANCELLED:
                await this.handleOrderCancellation(queryRunner, order, metadata);
                break;

            // Добавьте обработку других статусов по мере необходимости
        }
    }

    private async handleDriverAssignment(
        queryRunner: any,
        order: Order
    ): Promise<void> {
        if (!order.driver) {
            throw new BadRequestException('No driver assigned to order');
        }

        // Обновляем статус водителя
        await queryRunner.manager.update(
            Driver,
            { id: order.driver.id },
            { status: DriverStatus.BUSY }
        );
    }

    private async handleOrderCompletion(
        queryRunner: any,
        order: Order
    ): Promise<void> {
        if (order.driver) {
            // Обновляем статус водителя на ONLINE
            await queryRunner.manager.update(
                Driver,
                { id: order.driver.id },
                { 
                    status: DriverStatus.ONLINE,
                    totalRides: () => '"totalRides" + 1'
                }
            );
        }
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
    }

    private async sendStatusNotifications(
        order: Order,
        newStatus: OrderStatus,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.notificationQueueService.addToQueue({
            type: 'orderStatus',
            payload: {
                order,
                status: newStatus,
                additionalData: metadata
            }
        });
    }
}