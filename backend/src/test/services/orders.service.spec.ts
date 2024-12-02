// src/test/services/orders.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from '../../services/orders.service';
import { Order, OrderStatus, OrderType } from '../../entities/order.entity';
import { PriceService } from '../../services/price.service';
import { DriverAssignmentService } from '../../services/driver-assignment.service';
import { TransactionService } from '../../services/transaction.service';
import { CarClass } from '../../entities/driver.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: Repository<Order>;
  let priceService: PriceService;
  let driverAssignmentService: DriverAssignmentService;
  let transactionService: TransactionService;

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn()
    }))
  };

  const mockPriceService = {
    calculatePrice: jest.fn(),
    calculateCommission: jest.fn()
  };

  const mockDriverAssignmentService = {
    findDriverForOrder: jest.fn(),
    assignDriverToOrder: jest.fn()
  };

  const mockTransactionService = {
    createOrderTransaction: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository
        },
        {
          provide: PriceService,
          useValue: mockPriceService
        },
        {
          provide: DriverAssignmentService,
          useValue: mockDriverAssignmentService
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService
        }
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    priceService = module.get<PriceService>(PriceService);
    driverAssignmentService = module.get<DriverAssignmentService>(DriverAssignmentService);
    transactionService = module.get<TransactionService>(TransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createOrderDto = {
      type: OrderType.PRE_ORDER,
      carClass: CarClass.PREMIUM,
      pickupDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // завтра
      pickupAddress: {
        address: 'Test Address',
        latitude: 55.7558,
        longitude: 37.6173
      }
    };

    const userId = 'test-user-id';

    it('should create order successfully', async () => {
      const mockPrice = { basePrice: 1000, discount: 0, finalPrice: 1000 };
      const mockCommission = 250;
      const mockOrder = { id: 'test-order-id', ...createOrderDto };

      mockPriceService.calculatePrice.mockReturnValue(mockPrice);
      mockPriceService.calculateCommission.mockReturnValue(mockCommission);
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.create(createOrderDto, userId);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-order-id');
      expect(mockPriceService.calculatePrice).toHaveBeenCalled();
      expect(mockPriceService.calculateCommission).toHaveBeenCalled();
      expect(mockOrderRepository.create).toHaveBeenCalled();
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for past pickup time', async () => {
      const pastOrderDto = {
        ...createOrderDto,
        pickupDatetime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // вчера
      };

      await expect(service.create(pastOrderDto, userId))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return order if exists', async () => {
      const mockOrder = { id: 'test-order-id' };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.findById('test-order-id');
      expect(result).toBeDefined();
      expect(result.id).toBe('test-order-id');
    });

    it('should throw NotFoundException if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    const mockOrder = {
      id: 'test-order-id',
      status: OrderStatus.CREATED
    };

    it('should update order status successfully', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED
      });

      const result = await service.updateStatus(
        'test-order-id',
        OrderStatus.CONFIRMED
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.COMPLETED
      });

      await expect(
        service.updateStatus('test-order-id', OrderStatus.CONFIRMED)
      ).rejects.toThrow(BadRequestException);
    });

    it('should create transaction when completing order', async () => {
      const completedOrder = {
        ...mockOrder,
        status: OrderStatus.STARTED,
        driver: { id: 'driver-id' }
      };

      mockOrderRepository.findOne.mockResolvedValue(completedOrder);
      mockOrderRepository.save.mockResolvedValue({
        ...completedOrder,
        status: OrderStatus.COMPLETED
      });

      await service.updateStatus('test-order-id', OrderStatus.COMPLETED);

      expect(transactionService.createOrderTransaction).toHaveBeenCalled();
    });
  });
});