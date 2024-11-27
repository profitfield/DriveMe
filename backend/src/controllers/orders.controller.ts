import { Controller, Post, Body, Get, Param, UseGuards, Request, NotFoundException, BadRequestException, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Order } from '../entities/order.entity';
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
  @ApiResponse({ status: 201, description: 'Order successfully created' })
  @RateLimit(rateLimitConfig.orders.create)
  async createOrder(
    @Request() req,
    @Body() createOrderDto: CreateOrderDto
  ): Promise<Order> {
    return this.ordersService.create(createOrderDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user orders' })
  @ApiResponse({ status: 200, description: 'Returns list of orders' })
  async getUserOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.findByClientId(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Returns order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(
    @Param('id') id: string,
    @Request() req
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @RateLimit(rateLimitConfig.orders.status)
  async updateOrderStatus(
    @Param('id') id: string,
    @Request() req,
    @Body() updateStatusDto: UpdateOrderStatusDto
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.ordersService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  async cancelOrder(
    @Param('id') id: string,
    @Request() req,
    @Body('reason') reason: string
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.client.id !== req.user.userId) {
      throw new BadRequestException('Access denied');
    }
    return this.ordersService.cancelOrder(id, reason);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active orders' })
  @ApiResponse({ status: 200, description: 'Returns list of active orders' })
  async getActiveOrders(): Promise<Order[]> {
    return this.ordersService.getActiveOrders();
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming orders' })
  @ApiResponse({ status: 200, description: 'Returns list of upcoming orders' })
  async getUpcomingOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.getUpcomingOrders(req.user.userId);
  }
}