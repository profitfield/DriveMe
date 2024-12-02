// src/services/price.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CarClass } from '../entities/driver.entity';
import { OrderType } from '../entities/order.entity';

interface CarClassPrices {
  firstHour: number;
  minuteRate: number;
  airports: {
    SVO: number;
    DME: number;
    VKO: number;
  };
}

interface PriceCalculation {
  basePrice: number;
  discount: number;
  finalPrice: number;
}

@Injectable()
export class PriceService {
  private readonly carClassPrices: Record<CarClass, CarClassPrices>;
  private readonly commissionRate: number;
  private readonly hourlyDiscounts: { hours: number; discount: number }[];

  constructor(private configService: ConfigService) {
    // Инициализация цен для разных классов автомобилей
    this.carClassPrices = {
      [CarClass.PREMIUM]: {
        firstHour: this.configService.get<number>('PREMIUM_FIRST_HOUR', 4200),
        minuteRate: this.configService.get<number>('PREMIUM_MINUTE_RATE', 70),
        airports: {
          SVO: this.configService.get<number>('PREMIUM_AIRPORT_SVO', 6000),
          DME: this.configService.get<number>('PREMIUM_AIRPORT_DME', 7000),
          VKO: this.configService.get<number>('PREMIUM_AIRPORT_VKO', 6000)
        }
      },
      [CarClass.PREMIUM_LARGE]: {
        firstHour: this.configService.get<number>('PREMIUM_FIRST_HOUR', 4200),
        minuteRate: this.configService.get<number>('PREMIUM_MINUTE_RATE', 70),
        airports: {
          SVO: this.configService.get<number>('PREMIUM_AIRPORT_SVO', 6000),
          DME: this.configService.get<number>('PREMIUM_AIRPORT_DME', 7000),
          VKO: this.configService.get<number>('PREMIUM_AIRPORT_VKO', 6000)
        }
      },
      [CarClass.ELITE]: {
        firstHour: this.configService.get<number>('ELITE_FIRST_HOUR', 4800),
        minuteRate: this.configService.get<number>('ELITE_MINUTE_RATE', 80),
        airports: {
          SVO: this.configService.get<number>('ELITE_AIRPORT_SVO', 7000),
          DME: this.configService.get<number>('ELITE_AIRPORT_DME', 8000),
          VKO: this.configService.get<number>('ELITE_AIRPORT_VKO', 7000)
        }
      }
    };

    // Инициализация скидок для почасовой аренды
    this.hourlyDiscounts = [
      { hours: 12, discount: this.configService.get<number>('DISCOUNT_12_HOURS', 30) / 100 },
      { hours: 10, discount: this.configService.get<number>('DISCOUNT_10_HOURS', 25) / 100 },
      { hours: 8, discount: this.configService.get<number>('DISCOUNT_8_HOURS', 20) / 100 },
      { hours: 6, discount: this.configService.get<number>('DISCOUNT_6_HOURS', 15) / 100 },
      { hours: 4, discount: this.configService.get<number>('DISCOUNT_4_HOURS', 10) / 100 },
      { hours: 2, discount: this.configService.get<number>('DISCOUNT_2_HOURS', 5) / 100 }
    ];

    // Инициализация комиссии сервиса
    this.commissionRate = this.configService.get<number>('COMMISSION_RATE', 0.25);
  }

  calculatePrice(
    type: OrderType,
    carClass: CarClass,
    durationHours?: number,
    airport?: 'SVO' | 'DME' | 'VKO'
  ): PriceCalculation {
    const prices = this.carClassPrices[carClass];

    switch (type) {
      case OrderType.AIRPORT:
        if (!airport) {
          throw new Error('Airport code is required for airport orders');
        }
        const airportPrice = prices.airports[airport];
        return {
          basePrice: airportPrice,
          discount: 0,
          finalPrice: airportPrice
        };

      case OrderType.HOURLY:
        if (!durationHours) {
          throw new Error('Duration is required for hourly orders');
        }
        
        // Расчет базовой цены
        const basePrice = prices.firstHour * durationHours;
        
        // Применение скидки
        const discount = this.calculateHourlyDiscount(durationHours, basePrice);
        const finalPrice = basePrice - discount;

        return {
          basePrice,
          discount,
          finalPrice
        };

      case OrderType.PRE_ORDER:
        const preOrderPrice = prices.firstHour;
        const extraMinutes = durationHours && durationHours > 1 
          ? (durationHours - 1) * 60 
          : 0;
        const extraPrice = extraMinutes * prices.minuteRate / 60;

        return {
          basePrice: preOrderPrice + extraPrice,
          discount: 0,
          finalPrice: preOrderPrice + extraPrice
        };

      default:
        throw new Error(`Unsupported order type: ${type}`);
    }
  }

  calculateCommission(price: number): number {
    return Math.round(price * this.commissionRate);
  }

  private calculateHourlyDiscount(hours: number, basePrice: number): number {
    const applicableDiscount = this.hourlyDiscounts
      .find(discount => hours >= discount.hours);

    if (!applicableDiscount) {
      return 0;
    }

    return basePrice * applicableDiscount.discount;
  }

  getPriceEstimate(
    type: OrderType,
    carClass: CarClass,
    durationHours?: number,
    airport?: 'SVO' | 'DME' | 'VKO'
  ): {
    price: number;
    commission: number;
    total: number;
  } {
    const calculation = this.calculatePrice(type, carClass, durationHours, airport);
    const commission = this.calculateCommission(calculation.finalPrice);

    return {
      price: calculation.finalPrice,
      commission,
      total: calculation.finalPrice + commission
    };
  }

  getHourlyDiscounts(): { hours: number; discount: number }[] {
    return this.hourlyDiscounts.map(discount => ({
      hours: discount.hours,
      discount: discount.discount * 100
    }));
  }
}