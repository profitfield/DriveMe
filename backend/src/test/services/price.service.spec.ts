// src/test/services/price.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PriceService } from '../../services/price.service';
import { OrderType } from '../../entities/order.entity';
import { CarClass } from '../../entities/driver.entity';

describe('PriceService', () => {
  let service: PriceService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'PREMIUM_FIRST_HOUR': 4200,
        'PREMIUM_MINUTE_RATE': 70,
        'PREMIUM_AIRPORT_SVO': 6000,
        'PREMIUM_AIRPORT_DME': 7000,
        'PREMIUM_AIRPORT_VKO': 6000,
        'ELITE_FIRST_HOUR': 4800,
        'ELITE_MINUTE_RATE': 80,
        'COMMISSION_RATE': 0.25,
        'DISCOUNT_2_HOURS': 5,
      };
      return config[key];
    })
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    service = module.get<PriceService>(PriceService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePrice', () => {
    it('should calculate airport transfer price correctly', () => {
      const result = service.calculatePrice(
        OrderType.AIRPORT,
        CarClass.PREMIUM,
        undefined,
        'SVO'
      );

      expect(result.finalPrice).toBe(6000);
      expect(result.discount).toBe(0);
    });

    it('should calculate hourly rental with discount correctly', () => {
      const result = service.calculatePrice(
        OrderType.HOURLY,
        CarClass.PREMIUM,
        2
      );

      // 4200 * 2 = 8400, скидка 5% = 420
      expect(result.basePrice).toBe(8400);
      expect(result.discount).toBe(420);
      expect(result.finalPrice).toBe(7980);
    });

    it('should calculate pre-order price correctly', () => {
      const result = service.calculatePrice(
        OrderType.PRE_ORDER,
        CarClass.ELITE,
        1
      );

      expect(result.finalPrice).toBe(4800);
      expect(result.discount).toBe(0);
    });
  });

  describe('calculateCommission', () => {
    it('should calculate commission correctly', () => {
      const price = 1000;
      const result = service.calculateCommission(price);
      expect(result).toBe(250); // 25% от 1000
    });
  });
});