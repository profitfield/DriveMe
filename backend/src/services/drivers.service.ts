// backend/src/services/drivers.service.ts

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Driver, DriverStatus, CarClass } from '../entities/driver.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { CreateDriverDto } from '../dto/driver.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class DriversService {
    private readonly logger = new Logger(DriversService.name);
    private readonly CACHE_TTL = 60; // 1 минута для локации и статуса

    constructor(
        @InjectRepository(Driver)
        private driversRepository: Repository<Driver>,
        @InjectRepository(Order)
        private ordersRepository: Repository<Order>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) {}

    async create(createDriverDto: CreateDriverDto): Promise<Driver> {
        // Проверяем, что пользователь еще не зарегистрирован как водитель
        const existingDriver = await this.findByUserId(createDriverDto.userId);
        if (existingDriver) {
            throw new BadRequestException('User is already registered as a driver');
        }

        const driver = this.driversRepository.create({
            user: { id: createDriverDto.userId },
            carClass: createDriverDto.carClass,
            carInfo: createDriverDto.carInfo,
            status: DriverStatus.OFFLINE,
            rating: 5.0,
            totalRides: 0,
            commissionBalance: 0
        });

        return this.driversRepository.save(driver);
    }

    async findById(id: string): Promise<Driver> {
        const driver = await this.driversRepository.findOne({
            where: { id },
            relations: ['user'],
        });
        
        if (!driver) {
            throw new NotFoundException('Driver not found');
        }
        
        return driver;
    }

    async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
        const driver = await this.findById(id);
        
        // Проверяем возможность перехода в новый статус
        if (!this.canChangeStatus(driver.status, status)) {
            throw new BadRequestException(`Cannot change status from ${driver.status} to ${status}`);
        }

        // Если водитель становится оффлайн, проверяем активные заказы
        if (status === DriverStatus.OFFLINE) {
            const hasActiveOrders = await this.hasActiveOrders(id);
            if (hasActiveOrders) {
                throw new BadRequestException('Cannot go offline with active orders');
            }
        }

        driver.status = status;

        // Обновляем кэш статуса
        await this.cacheManager.set(
            `driver:status:${id}`,
            status,
            this.CACHE_TTL
        );

        return this.driversRepository.save(driver);
    }

    private canChangeStatus(currentStatus: DriverStatus, newStatus: DriverStatus): boolean {
        const validTransitions = {
            [DriverStatus.OFFLINE]: [DriverStatus.ONLINE],
            [DriverStatus.ONLINE]: [DriverStatus.OFFLINE, DriverStatus.BUSY, DriverStatus.BREAK],
            [DriverStatus.BUSY]: [DriverStatus.ONLINE],
            [DriverStatus.BREAK]: [DriverStatus.ONLINE, DriverStatus.OFFLINE]
        };

        return validTransitions[currentStatus]?.includes(newStatus) ?? false;
    }

    async getAvailableDrivers(carClass: CarClass): Promise<Driver[]> {
        return this.driversRepository.find({
            where: {
                carClass,
                status: DriverStatus.ONLINE,
            },
            relations: ['user'],
        });
    }

    async findByUserId(userId: string): Promise<Driver | null> {
        return this.driversRepository.findOne({
            where: { user: { id: userId } },
            relations: ['user'],
        });
    }

    async getActiveDrivers(): Promise<Driver[]> {
        return this.driversRepository.find({
            where: [
                { status: DriverStatus.ONLINE },
                { status: DriverStatus.BUSY }
            ],
            relations: ['user'],
        });
    }

    async updateDriverRating(id: string, rating: number): Promise<Driver> {
        if (rating < 1 || rating > 5) {
            throw new BadRequestException('Rating must be between 1 and 5');
        }

        const driver = await this.findById(id);
        
        // Обновляем рейтинг с учетом истории
        driver.rating = (driver.rating * driver.totalRides + rating) / (driver.totalRides + 1);
        driver.totalRides += 1;
        
        return this.driversRepository.save(driver);
    }

    async updateLocation(
        driverId: string, 
        latitude: number, 
        longitude: number
    ): Promise<void> {
        const location = { latitude, longitude, timestamp: new Date() };
        
        // Сохраняем локацию в кэше
        await this.cacheManager.set(
            `driver:location:${driverId}`,
            location,
            this.CACHE_TTL
        );
    }

    async getDriverLocation(driverId: string): Promise<any> {
        const location = await this.cacheManager.get(`driver:location:${driverId}`);
        
        if (!location) {
            throw new NotFoundException('Driver location not found');
        }

        return location;
    }

    private async hasActiveOrders(driverId: string): Promise<boolean> {
        const activeStatuses = [
            OrderStatus.DRIVER_ASSIGNED,
            OrderStatus.CONFIRMED,
            OrderStatus.EN_ROUTE,
            OrderStatus.ARRIVED,
            OrderStatus.STARTED
        ];

        const activeOrders = await this.ordersRepository.count({
            where: {
                driver: { id: driverId },
                status: In(activeStatuses)
            }
        });

        return activeOrders > 0;
    }

    async getDriverStatistics(driverId: string): Promise<{
        totalRides: number;
        rating: number;
        completionRate: number;
    }> {
        const driver = await this.findById(driverId);
        const orders = await this.ordersRepository.find({
            where: { driver: { id: driverId } }
        });

        const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
        const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);

        const completionRate = orders.length > 0 ? 
            (completedOrders.length / (orders.length - cancelledOrders.length)) * 100 : 
            100;

        return {
            totalRides: driver.totalRides,
            rating: driver.rating,
            completionRate
        };
    }
}