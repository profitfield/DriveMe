import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { CreateOrderDto } from '../dto/order.dto';
import { PriceService } from './price.service';
import { DriverAssignmentService } from './driver-assignment.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private priceService: PriceService,
    private driverAssignmentService: DriverAssignmentService
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    const pickupDatetime = new Date(createOrderDto.pickupDatetime);
    
    if (pickupDatetime < new Date()) {
      throw new BadRequestException('Pickup time cannot be in the past');
    }

    // Расчет стоимости и комиссии
    const priceCalculation = this.priceService.calculatePrice(
      createOrderDto.type,
      createOrderDto.carClass,
      createOrderDto.durationHours,
      this.getAirportCode(createOrderDto.destinationAddress?.address)
    );

    const commission = this.priceService.calculateCommission(priceCalculation.finalPrice);

    const order = this.ordersRepository.create({
      ...createOrderDto,
      client: { id: userId },
      pickupDatetime,
      price: priceCalculation.finalPrice,
      commission,
      status: OrderStatus.CREATED,
      paymentType: 'cash',
      bonusPayment: 0
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Пытаемся автоматически назначить водителя
    await this.driverAssignmentService.assignDriverToOrder(savedOrder.id);

    return this.findById(savedOrder.id);
  }

  async findById(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['client', 'driver']
    });
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    return order;
  }

  async findByClientId(clientId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { client: { id: clientId } },
      relations: ['driver'],
      order: { createdAt: 'DESC' }
    });
  }

  async getActiveOrders(): Promise<Order[]> {
    const activeStatuses = [
      OrderStatus.CREATED,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.CONFIRMED,
      OrderStatus.EN_ROUTE,
      OrderStatus.ARRIVED,
      OrderStatus.STARTED
    ];

    return this.ordersRepository.find({
      where: {
        status: In(activeStatuses)
      },
      relations: ['client', 'driver'],
      order: { pickupDatetime: 'ASC' }
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
      relations: ['driver'],
      order: { pickupDatetime: 'ASC' }
    });
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    const order = await this.findById(id);

    const cancellableStatuses = [
      OrderStatus.CREATED,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.CONFIRMED
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled in current status');
    }

    order.status = OrderStatus.CANCELLED;
    order.cancellationReason = reason;
    return this.ordersRepository.save(order);
  }

  private getAirportCode(address?: string): 'SVO' | 'DME' | 'VKO' | undefined {
    if (!address) return undefined;
    
    if (address.includes('Шереметьево')) return 'SVO';
    if (address.includes('Домодедово')) return 'DME';
    if (address.includes('Внуково')) return 'VKO';
    
    return undefined;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findById(id);
    
    if (!this.isValidStatusTransition(order.status, status)) {
      throw new BadRequestException('Invalid status transition');
    }

    order.status = status;
    return this.ordersRepository.save(order);
  }

  private isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
    const validTransitions = {
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

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  async getOrderStatistics(userId: string): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    revenue: number;
  }> {
    const orders = await this.ordersRepository.find({
      where: { client: { id: userId } }
    });

    return {
      total: orders.length,
      completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
      cancelled: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
      revenue: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, order) => sum + Number(order.price), 0)
    };
  }
}