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
  Logger,
  Query,
  ParseUUIDPipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { OrderStatusService } from '../services/order-status.service';
import { 
  CreateOrderDto, 
  UpdateOrderStatusDto, 
  OrderResponseDto,
  OrderStatusMetadataDto
} from '../dto/order.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../services/auth.service';
import { Order, OrderStatus, OrderType } from '../entities/order.entity';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { CarClass } from '../entities/driver.entity';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
      private readonly ordersService: OrdersService,
      private readonly orderStatusService: OrderStatusService
  ) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Создать новый заказ' })
  @ApiResponse({ 
      status: 201, 
      description: 'Заказ успешно создан',
      type: OrderResponseDto 
  })
  @RateLimit({ points: 10, duration: 60, keyPrefix: 'orders:create' })
  async createOrder(
      @Request() req,
      @Body() createOrderDto: CreateOrderDto
  ): Promise<Order> {
      this.logger.log(`Создание заказа пользователем: ${req.user.sub}`);
      return this.ordersService.create(createOrderDto, req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить заказ по ID' })
  @ApiResponse({ 
      status: 200, 
      description: 'Детали заказа',
      type: OrderResponseDto 
  })
  async getOrder(
      @Param('id', ParseUUIDPipe) id: string,
      @Request() req
  ): Promise<Order> {
      const order = await this.ordersService.findById(id);
      
      if (!this.canAccessOrder(order, req.user)) {
          throw new BadRequestException('Нет доступа к заказу');
      }

      return order;
  }

  @Get('user/upcoming')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Получить предстоящие заказы пользователя' })
  @ApiResponse({
      status: 200,
      description: 'Список предстоящих заказов',
      type: [OrderResponseDto]
  })
  async getUpcomingOrders(@Request() req): Promise<Order[]> {
      return this.ordersService.getUpcomingOrders(req.user.sub);
  }

  @Get('user/history')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Получить историю заказов' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
      status: 200,
      description: 'История заказов',
      type: [OrderResponseDto]
  })
  async getOrderHistory(
      @Request() req,
      @Query('limit') limit: number = 10,
      @Query('offset') offset: number = 0
  ): Promise<Order[]> {
      return this.ordersService.findByClientId(req.user.sub);
  }

  @Get('user/statistics')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Получить статистику заказов пользователя' })
  @ApiResponse({
      status: 200,
      description: 'Статистика заказов'
  })
  async getUserStatistics(@Request() req): Promise<any> {
      return this.ordersService.getClientStatistics(req.user.sub);
  }

  @Get('driver/statistics')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить статистику заказов водителя' })
  @ApiResponse({
      status: 200,
      description: 'Статистика заказов'
  })
  async getDriverStatistics(@Request() req): Promise<any> {
      return this.ordersService.getDriverStatistics(req.user.sub);
  }

  @Get('available')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить доступные заказы' })
  @ApiQuery({ name: 'carClass', enum: CarClass, required: false })
  @ApiResponse({
      status: 200,
      description: 'Список доступных заказов',
      type: [OrderResponseDto]
  })
  async getAvailableOrders(
      @Query('carClass') carClass?: CarClass
  ): Promise<Order[]> {
      return this.ordersService.getAvailableOrders(carClass);
  }

  @Post('calculate')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Рассчитать стоимость заказа' })
  @ApiResponse({ 
      status: 200, 
      description: 'Расчет стоимости'
  })
  async calculateOrderPrice(
      @Body() createOrderDto: CreateOrderDto
  ): Promise<{
      basePrice: number;
      discount: number;
      finalPrice: number;
      commission: number;
  }> {
      return this.ordersService.calculateOrderPrice(createOrderDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Обновить статус заказа' })
  @ApiResponse({ 
      status: 200, 
      description: 'Статус обновлен',
      type: OrderResponseDto 
  })
  @RateLimit({ points: 30, duration: 60, keyPrefix: 'orders:status' })
  async updateOrderStatus(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updateStatusDto: UpdateOrderStatusDto,
      @Request() req
  ): Promise<Order> {
      const order = await this.ordersService.findById(id);
      
      if (!this.canUpdateOrderStatus(order, updateStatusDto.status, req.user)) {
          throw new BadRequestException('Нет прав на изменение статуса');
      }

      return this.orderStatusService.updateOrderStatus(
          id, 
          updateStatusDto.status,
          {
              userId: req.user.sub,
              role: req.user.role,
              metadata: updateStatusDto.metadata
          }
      );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Отменить заказ' })
  @ApiResponse({ 
      status: 200, 
      description: 'Заказ отменен',
      type: OrderResponseDto 
  })
  async cancelOrder(
      @Param('id', ParseUUIDPipe) id: string,
      @Body('reason') reason: string,
      @Request() req
  ): Promise<Order> {
      const order = await this.ordersService.findById(id);
      
      if (order.client.id !== req.user.sub) {
          throw new BadRequestException('Можно отменять только свои заказы');
      }

      this.logger.log(`Отмена заказа ${id} пользователем ${req.user.sub}`);
      return this.ordersService.cancelOrder(id, reason);
  }

  @Post(':id/rate')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Оценить заказ' })
  @ApiResponse({
      status: 200,
      description: 'Оценка сохранена',
      type: OrderResponseDto
  })
  async rateOrder(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() statusMetadata: OrderStatusMetadataDto,
      @Request() req
  ): Promise<Order> {
      const order = await this.ordersService.findById(id);
      
      if (order.client.id !== req.user.sub) {
          throw new BadRequestException('Можно оценивать только свои заказы');
      }

      if (order.status !== OrderStatus.COMPLETED) {
          throw new BadRequestException('Можно оценивать только завершенные заказы');
      }

      return this.orderStatusService.updateOrderStatus(
          id,
          OrderStatus.COMPLETED,
          {
              userId: req.user.sub,
              role: req.user.role,
              metadata: statusMetadata
          }
      );
  }

  private canAccessOrder(order: Order, user: any): boolean {
      if (user.role === UserRole.CLIENT) {
          return order.client.id === user.sub;
      }
      if (user.role === UserRole.DRIVER) {
          return order.driver?.id === user.sub;
      }
      return false;
  }

  private canUpdateOrderStatus(order: Order, newStatus: OrderStatus, user: any): boolean {
      if (!order.driver || order.driver.id !== user.sub) {
          return false;
      }

      const allowedStatuses = [
          OrderStatus.EN_ROUTE,
          OrderStatus.ARRIVED,
          OrderStatus.STARTED,
          OrderStatus.COMPLETED
      ];

      return allowedStatuses.includes(newStatus);
  }
}