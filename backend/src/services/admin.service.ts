import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Entities
import { AdminUser } from '../entities/admin-user.entity';
import { AdminLog, AdminActionType } from '../entities/admin-log.entity';
import { AdminSettings } from '../entities/admin-settings.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { User } from '../entities/user.entity';

// DTOs
import { 
  CreateAdminDto, 
  UpdateAdminDto, 
  OrderFiltersDto, 
  DriverFiltersDto 
} from '../dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    @InjectRepository(AdminLog)
    private adminLogRepository: Repository<AdminLog>,
    @InjectRepository(AdminSettings)
    private adminSettingsRepository: Repository<AdminSettings>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  // Admin Users Management
  async createAdmin(createAdminDto: CreateAdminDto): Promise<AdminUser> {
    const existingAdmin = await this.adminUserRepository.findOne({
      where: { email: createAdminDto.email }
    });

    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    const admin = this.adminUserRepository.create({
      ...createAdminDto,
      password: hashedPassword
    });

    return this.adminUserRepository.save(admin);
  }

  async updateAdmin(id: string, updateAdminDto: UpdateAdminDto): Promise<AdminUser> {
    const admin = await this.adminUserRepository.findOne({
      where: { id }
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    Object.assign(admin, updateAdminDto);
    return this.adminUserRepository.save(admin);
  }

  // Orders Management
  async getOrders(filters: OrderFiltersDto) {
    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.client', 'client')
      .leftJoinAndSelect('order.driver', 'driver');

    if (filters.startDate && filters.endDate) {
      query.andWhere('order.pickupDatetime BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate)
      });
    }

    if (filters.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters.clientId) {
      query.andWhere('client.id = :clientId', { clientId: filters.clientId });
    }

    if (filters.driverId) {
      query.andWhere('driver.id = :driverId', { driverId: filters.driverId });
    }

    query.orderBy('order.createdAt', 'DESC');

    return query.getMany();
  }

  async getOrderDetails(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['client', 'driver']
    });
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    return order;
  }

  // Drivers Management
  async getDrivers(filters: DriverFiltersDto) {
    const query = this.driverRepository.createQueryBuilder('driver')
      .leftJoinAndSelect('driver.user', 'user');

    if (filters.status) {
      query.andWhere('driver.status = :status', { status: filters.status });
    }

    if (filters.carClass) {
      query.andWhere('driver.carClass = :carClass', { carClass: filters.carClass });
    }

    if (filters.rating) {
      query.andWhere('driver.rating >= :rating', { rating: filters.rating });
    }

    query.orderBy('driver.rating', 'DESC');

    return query.getMany();
  }

  async updateDriverStatus(id: string, status: DriverStatus, adminId: string) {
    const driver = await this.driverRepository.findOne({ 
      where: { id },
      relations: ['user']
    });
    
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const oldStatus = driver.status;
    driver.status = status;
    const updatedDriver = await this.driverRepository.save(driver);

    await this.logAction(adminId, AdminActionType.STATUS, {
      driverId: id,
      oldStatus,
      newStatus: status
    });

    return updatedDriver;
  }

  // Settings Management
  async updateSettings(key: string, value: any, adminId: string) {
    let settings = await this.adminSettingsRepository.findOne({
      where: { key }
    });

    if (!settings) {
      settings = this.adminSettingsRepository.create({ key });
    }

    const oldValue = settings.value;
    settings.value = value;
    const savedSettings = await this.adminSettingsRepository.save(settings);

    await this.logAction(adminId, AdminActionType.SETTINGS, {
      key,
      oldValue,
      newValue: value
    });

    return savedSettings;
  }

  async getSettings() {
    return this.adminSettingsRepository.find();
  }

  // Statistics
  async getStatistics(period: string) {
    const startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        throw new BadRequestException('Invalid period');
    }

    const orders = await this.orderRepository.find({
      where: {
        createdAt: Between(startDate, endDate)
      }
    });

    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
    const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);

    const totalRevenue = completedOrders.reduce((sum, order) => sum + Number(order.price), 0);
    const totalCommission = completedOrders.reduce((sum, order) => sum + Number(order.commission), 0);

    return {
      period,
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      totalCommission,
      completionRate: orders.length ? (completedOrders.length / orders.length) * 100 : 0,
      averageOrderValue: completedOrders.length ? totalRevenue / completedOrders.length : 0
    };
  }

  // Logs
  async getLogs(startDate: string, endDate: string, type?: string) {
    const query = this.adminLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.admin', 'admin')
      .where('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

    if (type) {
      query.andWhere('log.action = :type', { type });
    }

    query.orderBy('log.createdAt', 'DESC');

    return query.getMany();
  }

  private async logAction(
    adminId: string, 
    action: AdminActionType, 
    details: Record<string, any>
  ) {
    const log = this.adminLogRepository.create({
      admin: { id: adminId },
      action,
      details,
      entityType: this.getEntityTypeFromAction(action),
      entityId: details.id || null
    });

    return this.adminLogRepository.save(log);
  }

  private getEntityTypeFromAction(action: AdminActionType): string {
    switch (action) {
      case AdminActionType.STATUS:
        return 'driver';
      case AdminActionType.SETTINGS:
        return 'settings';
      default:
        return 'unknown';
    }
  }
}