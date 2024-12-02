// src/controllers/admin.controller.ts

import { Controller, Get, Post, Body, Put, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { OrdersService } from '../services/orders.service';
import { DriversService } from '../services/drivers.service';
import { TransactionService } from '../services/transaction.service';
import { OrderStatus } from '../entities/order.entity';
import { DriverStatus } from '../entities/driver.entity';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly driversService: DriversService,
    private readonly transactionService: TransactionService
  ) {}

  @Get('orders/active')
  @ApiOperation({ summary: 'Get all active orders' })
  async getActiveOrders() {
    return this.ordersService.getActiveOrders();
  }

  @Get('orders/stats')
  @ApiOperation({ summary: 'Get orders statistics' })
  async getOrdersStats() {
    const orders = await this.ordersService.getAllOrders();
    return {
      total: orders.length,
      completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
      active: orders.filter(o => [
        OrderStatus.CREATED,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.CONFIRMED,
        OrderStatus.EN_ROUTE,
        OrderStatus.ARRIVED,
        OrderStatus.STARTED
      ].includes(o.status)).length,
      cancelled: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
      totalRevenue: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.price), 0),
      totalCommission: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.commission), 0)
    };
  }

  @Get('drivers/online')
  @ApiOperation({ summary: 'Get all online drivers' })
  async getOnlineDrivers() {
    return this.driversService.getActiveDrivers();
  }

  @Get('drivers/stats')
  @ApiOperation({ summary: 'Get drivers statistics' })
  async getDriversStats() {
    const drivers = await this.driversService.getActiveDrivers();
    return {
      total: drivers.length,
      online: drivers.filter(d => d.status === DriverStatus.ONLINE).length,
      busy: drivers.filter(d => d.status === DriverStatus.BUSY).length,
      totalCommissionBalance: drivers.reduce((sum, driver) => 
        sum + Number(driver.commissionBalance), 0)
    };
  }

  @Get('transactions/daily')
  @ApiOperation({ summary: 'Get daily transactions' })
  async getDailyTransactions() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.transactionService.findByDateRange(startOfDay, endOfDay);
    
    return {
      totalAmount: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
      totalCommission: transactions.reduce((sum, t) => sum + Number(t.commission), 0),
      count: transactions.length
    };
  }
}