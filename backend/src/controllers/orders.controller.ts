// src/controllers/orders.controller.ts

import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  UseGuards, 
  Request, 
  NotFoundException, 
  BadRequestException, 
  Patch,
  Query 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderResponseDto } from '../dto/order.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Order, OrderStatus } from '../entities/order.entity';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { rateLimitConfig } from '../config/rate-limit.config';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ 
    status: 201, 
    description: 'Order successfully created',
    type: OrderResponseDto 
  })
  @RateLimit(rateLimitConfig.orders.create)
  async createOrder(
    @Request() req,
    @Body() createOrderDto: CreateOrderDto
  ): Promise<Order> {
    return this.ordersService.create(createOrderDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user orders' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of orders',
    type: [OrderResponseDto]
  })
  async getUserOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.findByClientId(req.user.userId);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming orders' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of upcoming orders',
    type: [OrderResponseDto]
  })
  async getUpcomingOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.getUpcomingOrders(req.user.userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active orders' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of active orders',
    type: [OrderResponseDto]
  })
  async getActiveOrders(): Promise<Order[]> {
    return this.ordersService.getActiveOrders();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns order statistics'
  })
  async getOrderStats(@Request() req) {
    return this.ordersService.getOrderStatistics(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns order details',
    type: OrderResponseDto
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(
    @Param('id') id: string,
    @Request() req
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    
    // Проверяем доступ к заказу
    if (order.client.id !== req.user.userId && 
        (!order.driver || order.driver.id !== req.user.userId)) {
      throw new BadRequestException('Access denied');
    }

    return order;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order status updated',
    type: OrderResponseDto 
  })
  @RateLimit(rateLimitConfig.orders.status)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Request() req
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    
    // Проверяем права на изменение статуса
    if (!this.canUpdateStatus(order, updateStatusDto.status, req.user)) {
      throw new BadRequestException('Cannot update order status');
    }

    return this.ordersService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order cancelled',
    type: OrderResponseDto
  })
  async cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    if (order.client.id !== req.user.userId) {
      throw new BadRequestException('Access denied');
    }
    return this.ordersService.cancelOrder(id, reason);
  }

  private canUpdateStatus(order: Order, newStatus: OrderStatus, user: any): boolean {
    // Клиент может только отменять заказ
    if (order.client.id === user.userId) {
      return newStatus === OrderStatus.CANCELLED;
    }

    // Водитель может обновлять статус своего заказа
    if (order.driver?.id === user.userId) {
      const driverAllowedStatuses = [
        OrderStatus.EN_ROUTE,
        OrderStatus.ARRIVED,
        OrderStatus.STARTED,
        OrderStatus.COMPLETED
      ];
      return driverAllowedStatuses.includes(newStatus);
    }

    return false;
  }
}