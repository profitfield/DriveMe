// src/services/orders.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { Order, OrderStatus, OrderType, PaymentType, PaymentStatus } from '../entities/order.entity';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { CreateOrderDto } from '../dto/order.dto';
import { PriceService } from './price.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { TransactionService } from './transaction.service';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);
    private readonly CACHE_TTL = 300;

    constructor(
        @InjectRepository(Order)
        private ordersRepository: Repository<Order>,
        @InjectRepository(Driver)
        private driversRepository: Repository<Driver>,
        private priceService: PriceService,
        private driverAssignmentService: DriverAssignmentService,
        private transactionService: TransactionService,
        private notificationQueueService: NotificationQueueService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) {}

    async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
        // Расширенная валидация заказа
        await this.validateOrderCreation(createOrderDto);

        const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Расчет стоимости
            const priceCalculation = await this.calculateOrderPrice(createOrderDto);

            const order = queryRunner.manager.create(Order, {
                ...createOrderDto,
                client: { id: userId },
                estimatedPrice: priceCalculation.finalPrice,
                commission: priceCalculation.commission,
                status: OrderStatus.CREATED,
                paymentType: createOrderDto.paymentType || PaymentType.CASH,
                paymentStatus: PaymentStatus.PENDING,
                bonusPayment: createOrderDto.bonusPayment || 0
            });

            // Обработка оплаты бонусами
            if (order.bonusPayment > 0) {
                await this.processOrderPayment(order, queryRunner);
            }

            const savedOrder = await queryRunner.manager.save(Order, order);

            // Уведомление о создании заказа
            await this.notificationQueueService.addToQueue({
                type: 'orderStatus',
                payload: {
                    order: savedOrder,
                    status: OrderStatus.CREATED,
                    additionalData: {
                        price: priceCalculation.finalPrice,
                        paymentType: order.paymentType,
                        basePrice: priceCalculation.basePrice,
                        discount: priceCalculation.discount
                    }
                }
            });

            // Назначение водителя
            let driver = null;
            if (createOrderDto.useFavoriteDriver) {
                driver = await this.handleFavoriteDriver(savedOrder, createOrderDto);
            }
            
            if (!driver) {
                driver = await this.driverAssignmentService.findDriverForOrder(savedOrder);
            }

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
                                carInfo: driver.carInfo,
                                estimatedArrivalTime: await this.calculateETA(savedOrder)
                            }
                        }
                    });
                }
            }

            await queryRunner.commitTransaction();
            await this.cacheManager.set(`order:${savedOrder.id}`, savedOrder, this.CACHE_TTL);
            await this.invalidateActiveOrdersCache();

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
        const cachedOrder = await this.cacheManager.get<Order>(`order:${id}`);
        if (cachedOrder) {
            return cachedOrder;
        }

        const order = await this.ordersRepository.findOne({
            where: { id },
            relations: ['client', 'driver', 'driver.user']
        });

        if (!order) {
            throw new NotFoundException('Заказ не найден');
        }

        await this.cacheManager.set(`order:${id}`, order, this.CACHE_TTL);
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
        const activeStatuses = [
            OrderStatus.DRIVER_ASSIGNED,
            OrderStatus.CONFIRMED,
            OrderStatus.EN_ROUTE,
            OrderStatus.ARRIVED,
            OrderStatus.STARTED
        ];

        return this.ordersRepository.find({
            where: {
                driver: { id: driverId },
                status: In(activeStatuses)
            },
            relations: ['client', 'driver', 'driver.user'],
            order: { pickupDatetime: 'ASC' }
        });
    }

    async getAvailableOrders(carClass?: string): Promise<Order[]> {
        const query = this.ordersRepository.createQueryBuilder('order')
            .where('order.status = :status', { status: OrderStatus.CREATED })
            .andWhere('order.driver IS NULL')
            .leftJoinAndSelect('order.client', 'client');

        if (carClass) {
            query.andWhere('order.carClass = :carClass', { carClass });
        }

        return query.orderBy('order.pickupDatetime', 'ASC').getMany();
    }

    async getActiveOrders(): Promise<Order[]> {
        const cacheKey = 'active_orders';
        const cachedOrders = await this.cacheManager.get<Order[]>(cacheKey);
        
        if (cachedOrders) {
            return cachedOrders;
        }

        const activeStatuses = [
            OrderStatus.CREATED,
            OrderStatus.DRIVER_ASSIGNED,
            OrderStatus.CONFIRMED,
            OrderStatus.EN_ROUTE,
            OrderStatus.ARRIVED,
            OrderStatus.STARTED
        ];

        const orders = await this.ordersRepository.find({
            where: { 
                status: In(activeStatuses)
            },
            relations: ['client', 'driver', 'driver.user'],
            order: { 
                pickupDatetime: 'ASC'
            }
        });

        await this.cacheManager.set(cacheKey, orders, 30);
        return orders;
    }

    async getAllOrders(): Promise<Order[]> {
        return this.ordersRepository.find({
            relations: ['client', 'driver', 'driver.user'],
            order: {
                createdAt: 'DESC'
            }
        });
    }

    async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
        return this.ordersRepository.find({
            where: { status },
            relations: ['client', 'driver', 'driver.user'],
            order: { createdAt: 'DESC' }
        });
    }

    async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
        return this.ordersRepository.find({
            where: {
                createdAt: Between(startDate, endDate)
            },
            relations: ['client', 'driver', 'driver.user'],
            order: { createdAt: 'DESC' }
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

    async getAdminDashboardStatistics() {
        const activeOrders = await this.getActiveOrders();
        const allOrders = await this.getAllOrders();
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));

        const todayOrders = allOrders.filter(order => 
            new Date(order.createdAt) >= todayStart
        );

        const completedOrders = allOrders.filter(o => 
            o.status === OrderStatus.COMPLETED
        );

        return {
            activeOrders: activeOrders.length,
            totalOrders: allOrders.length,
            todayOrders: todayOrders.length,
            completedOrders: completedOrders.length,
            cancelledOrders: allOrders.filter(o => 
                o.status === OrderStatus.CANCELLED
            ).length,
            totalRevenue: completedOrders.reduce((sum, order) => 
                sum + Number(order.actualPrice || order.estimatedPrice), 0
            ),
            todayRevenue: todayOrders
                .filter(o => o.status === OrderStatus.COMPLETED)
                .reduce((sum, order) => 
                    sum + Number(order.actualPrice || order.estimatedPrice), 0
                ),
            totalCommission: completedOrders.reduce((sum, order) => 
                sum + Number(order.commission), 0
            )
        };
    }

    async calculateOrderPrice(createOrderDto: CreateOrderDto): Promise<{
        basePrice: number;
        discount: number;
        finalPrice: number;
        commission: number;
    }> {
        const priceCalculation = await this.priceService.calculatePrice(
            createOrderDto.type,
            createOrderDto.carClass,
            createOrderDto.durationHours,
            this.getAirportCode(createOrderDto.destinationAddress?.address)
        );

        const commission = this.priceService.calculateCommission(priceCalculation.finalPrice);

        return {
            basePrice: priceCalculation.basePrice,
            discount: priceCalculation.discount,
            finalPrice: priceCalculation.finalPrice,
            commission
        };
    }

    async updateStatus(id: string, newStatus: OrderStatus): Promise<Order> {
        const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const order = await this.findById(id);
            
            if (!this.isValidStatusTransition(order.status, newStatus)) {
                throw new BadRequestException(
                    `Недопустимый переход статуса с ${order.status} на ${newStatus}`
                );
            }

            order.status = newStatus;
            const additionalData: Record<string, any> = {
                oldStatus: order.status,
                newStatus: newStatus
            };

            if (newStatus === OrderStatus.COMPLETED && order.driver) {
                await this.handleOrderCompletion(order, queryRunner);
                additionalData.price = order.actualPrice;
                additionalData.driverEarnings = order.actualPrice - order.commission;
                additionalData.commission = order.commission;
            }

            if (newStatus === OrderStatus.EN_ROUTE) {
                additionalData.eta = await this.calculateETA(order);
            }

            await queryRunner.manager.save(Order, order);
            await this.invalidateActiveOrdersCache();
            await this.cacheManager.del(`order:${id}`);

            await this.notificationQueueService.addToQueue({
                type: 'orderStatus',
                payload: {
                    order,
                    status: newStatus,
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
                    additionalData: { orderId: id, status: newStatus }
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
            await this.invalidateActiveOrdersCache();
            await this.cacheManager.del(`order:${id}`);

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

    async getClientStatistics(clientId: string) {
        const orders = await this.ordersRepository.find({
            where: { client: { id: clientId } },
            relations: ['driver']
        });

        const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
        const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);
        
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthOrders = orders.filter(order => 
            new Date(order.createdAt) >= lastMonth
        );

        return {
            totalOrders: orders.length,
            completedOrders: completedOrders.length,
            cancelledOrders: cancelledOrders.length,
            totalSpent: completedOrders.reduce((sum, order) => 
                sum + Number(order.actualPrice || order.estimatedPrice), 0
            ),
            averageOrderCost: completedOrders.length > 0 
                ? completedOrders.reduce((sum, order) => 
                    sum + Number(order.actualPrice || order.estimatedPrice), 0
                  ) / completedOrders.length 
                : 0,
            lastMonthStatistics: {
                ordersCount: lastMonthOrders.length,
                completedCount: lastMonthOrders.filter(o => 
                    o.status === OrderStatus.COMPLETED
                ).length,
                totalSpent: lastMonthOrders
                    .filter(o => o.status === OrderStatus.COMPLETED)
                    .reduce((sum, order) => 
                        sum + Number(order.actualPrice || order.estimatedPrice), 0
                    )
            },
            completionRate: orders.length > 0
                ? ((completedOrders.length / 
                    (orders.length - cancelledOrders.length)) * 100).toFixed(1)
                : '100'
        };
    }

    async getDriverStatistics(driverId: string) {
        const orders = await this.ordersRepository.find({
            where: { driver: { id: driverId } },
            relations: ['client']
        });

        const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
        const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);

        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthOrders = orders.filter(order => 
            new Date(order.createdAt) >= lastMonth
        );

        return {
            totalOrders: orders.length,
            completedOrders: completedOrders.length,
            cancelledOrders: cancelledOrders.length,
            totalEarned: completedOrders.reduce((sum, order) => 
                sum + (Number(order.actualPrice || order.estimatedPrice) - 
                      Number(order.commission)), 0
            ),
            averageOrderEarning: completedOrders.length > 0
                ? completedOrders.reduce((sum, order) => 
                    sum + (Number(order.actualPrice || order.estimatedPrice) - 
                          Number(order.commission)), 0
                  ) / completedOrders.length
                : 0,
            lastMonthStatistics: {
                ordersCount: lastMonthOrders.length,
                completedCount: lastMonthOrders.filter(o => 
                    o.status === OrderStatus.COMPLETED
                ).length,
                totalEarned: lastMonthOrders
                    .filter(o => o.status === OrderStatus.COMPLETED)
                    .reduce((sum, order) => 
                        sum + (Number(order.actualPrice || order.estimatedPrice) - 
                              Number(order.commission)), 0
                    )
            },
            completionRate: orders.length > 0
                ? ((completedOrders.length / 
                    (orders.length - cancelledOrders.length)) * 100).toFixed(1)
                : '100',
            averageRating: completedOrders.length > 0 
                ? (completedOrders.reduce((sum, order) => 
                    sum + (order.rating || 0), 0
                  ) / completedOrders.length).toFixed(1)
                : '0',
            todayStatistics: {
                ordersCount: orders.filter(order => 
                    this.isToday(new Date(order.createdAt))
                ).length,
                earnings: orders
                    .filter(order => 
                        this.isToday(new Date(order.createdAt)) && 
                        order.status === OrderStatus.COMPLETED
                    )
                    .reduce((sum, order) => 
                        sum + (Number(order.actualPrice || order.estimatedPrice) - 
                              Number(order.commission)), 0
                    )
            }
        };
    }

    // Private helper methods
    private async validateOrderCreation(createOrderDto: CreateOrderDto): Promise<void> {
        const pickupDatetime = new Date(createOrderDto.pickupDatetime);
        const minAdvanceTime = 30; // минимальное время для предзаказа в минутах
        
        if (pickupDatetime < new Date()) {
            throw new BadRequestException('Время подачи не может быть в прошлом');
        }

        const minutesUntilPickup = Math.floor((pickupDatetime.getTime() - Date.now()) / (1000 * 60));
        
        if (createOrderDto.type === OrderType.PRE_ORDER && minutesUntilPickup < minAdvanceTime) {
            throw new BadRequestException(
                `Предварительный заказ должен быть оформлен минимум за ${minAdvanceTime} минут`
            );
        }

        if (createOrderDto.type === OrderType.HOURLY) {
            if (!createOrderDto.durationHours) {
                throw new BadRequestException('Для почасовой аренды необходимо указать длительность');
            }
            if (createOrderDto.durationHours < 2 || createOrderDto.durationHours > 12) {
                throw new BadRequestException('Длительность аренды должна быть от 2 до 12 часов');
            }
        }

        if (createOrderDto.type === OrderType.AIRPORT && !this.getAirportCode(createOrderDto.destinationAddress?.address)) {
            throw new BadRequestException('Для заказа в аэропорт необходимо указать корректный адрес аэропорта');
        }
    }

    private async handleOrderCompletion(order: Order, queryRunner: any): Promise<void> {
        order.actualPrice = order.estimatedPrice;
        order.paymentStatus = PaymentStatus.COMPLETED;
        
        if (order.driver) {
            order.driver.totalRides += 1;
            await queryRunner.manager.save(Driver, order.driver);
            
            await this.transactionService.createOrderTransaction(order);
        }
        
        // Начисление бонусов клиенту
        if (order.actualPrice > 0) {
            const bonusAmount = Math.floor(order.actualPrice * 0.05); // 5% бонусов
            const client = await queryRunner.manager.findOne('User', order.client.id);
            client.bonusBalance += bonusAmount;
            await queryRunner.manager.save('User', client);
        }
    }

    private async processOrderPayment(order: Order, queryRunner: any): Promise<void> {
        if (order.bonusPayment > 0) {
            const client = await queryRunner.manager.findOne('User', order.client.id);
            if (client.bonusBalance < order.bonusPayment) {
                throw new BadRequestException('Недостаточно бонусов для оплаты');
            }
            
            client.bonusBalance -= order.bonusPayment;
            await queryRunner.manager.save('User', client);
        }

        order.paymentStatus = PaymentStatus.PENDING;
        if (order.bonusPayment === order.estimatedPrice) {
            order.paymentStatus = PaymentStatus.COMPLETED;
        }
    }

    private async handleFavoriteDriver(order: Order, createOrderDto: CreateOrderDto): Promise<Driver | null> {
        if (!createOrderDto.useFavoriteDriver) {
            return null;
        }

        const favoriteDrivers = await this.driversRepository
            .createQueryBuilder('driver')
            .innerJoin('favorite_drivers', 'fav', 'fav.driver_id = driver.id')
            .where('fav.client_id = :clientId', { clientId: order.client.id })
            .andWhere('driver.status = :status', { status: DriverStatus.ONLINE })
            .andWhere('driver.car_class = :carClass', { carClass: order.carClass })
            .getMany();

        return favoriteDrivers.length > 0 ? favoriteDrivers[0] : null;
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

    private async calculateETA(order: Order): Promise<string> {
        // В реальном проекте здесь будет интеграция с сервисом маршрутизации
        // Для MVP возвращаем фиксированное значение
        return '15 минут';
    }

    private isToday(date: Date): boolean {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }

    private async invalidateActiveOrdersCache(): Promise<void> {
        await this.cacheManager.del('active_orders');
    }
}