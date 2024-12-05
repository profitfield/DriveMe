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
  Logger 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { OrderStatusService } from '../services/order-status.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderResponseDto } from '../dto/order.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../services/auth.service';
import { Order, OrderStatus } from '../entities/order.entity';
import { RateLimit } from '../decorators/rate-limit.decorator';

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

  @Get()
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Получить все заказы пользователя' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список заказов',
    type: [OrderResponseDto]
  })
  async getUserOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.findByClientId(req.user.sub);
  }

  @Get('driver/active')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить активные заказы водителя' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список активных заказов',
    type: [OrderResponseDto]
  })
  async getDriverActiveOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.findActiveOrdersByDriver(req.user.sub);
  }

  @Get('upcoming')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Получить предстоящие заказы' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список предстоящих заказов',
    type: [OrderResponseDto]
  })
  async getUpcomingOrders(@Request() req): Promise<Order[]> {
    return this.ordersService.getUpcomingOrders(req.user.sub);
  }

  @Get('available')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить доступные заказы' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список доступных заказов',
    type: [OrderResponseDto]
  })
  async getAvailableOrders(): Promise<Order[]> {
    return this.ordersService.getAvailableOrders();
  }

  @Get('stats')
  @Roles(UserRole.CLIENT, UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить статистику заказов' })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика заказов'
  })
  async getOrderStats(@Request() req) {
    const role = req.user.role;
    if (role === UserRole.CLIENT) {
      return this.ordersService.getClientStatistics(req.user.sub);
    }
    return this.ordersService.getDriverStatistics(req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.DRIVER)
  @ApiOperation({ summary: 'Получить заказ по ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Детали заказа',
    type: OrderResponseDto
  })
  @ApiResponse({ status: 404, description: 'Заказ не найден' })
  async getOrder(
    @Param('id') id: string,
    @Request() req
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    
    if (!this.canAccessOrder(order, req.user)) {
      throw new BadRequestException('Нет доступа к заказу');
    }

    return order;
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
    @Param('id') id: string,
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
        ...updateStatusDto.metadata
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
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req
  ): Promise<Order> {
    const order = await this.ordersService.findById(id);
    
    if (order.client.id !== req.user.sub) {
      throw new BadRequestException('Можно отменять только свои заказы');
    }

    this.logger.log(`Отмена заказа ${id} пользователем ${req.user.sub}`);
    return this.orderStatusService.updateOrderStatus(id, OrderStatus.CANCELLED, { reason });
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