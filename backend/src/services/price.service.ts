// src/services/price.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CarClass } from '../entities/driver.entity';
import { OrderType } from '../entities/order.entity';

interface PriceConfiguration {
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

interface HourlyDiscount {
  hours: number;
  discount: number;
}

@Injectable()
export class PriceService {
  private readonly priceConfigs: Record<CarClass, PriceConfiguration>;
  private readonly hourlyDiscounts: HourlyDiscount[];
  private readonly commissionRate: number;

  constructor(private readonly configService: ConfigService) {
    // Инициализация конфигурации цен для разных классов автомобилей
    this.priceConfigs = {
      [CarClass.PREMIUM]: {
        firstHour: this.getConfigNumber('PREMIUM_FIRST_HOUR', 4200),
        minuteRate: this.getConfigNumber('PREMIUM_MINUTE_RATE', 70),
        airports: {
          SVO: this.getConfigNumber('PREMIUM_AIRPORT_SVO', 6000),
          DME: this.getConfigNumber('PREMIUM_AIRPORT_DME', 7000),
          VKO: this.getConfigNumber('PREMIUM_AIRPORT_VKO', 6000)
        }
      },
      [CarClass.PREMIUM_LARGE]: {
        firstHour: this.getConfigNumber('PREMIUM_FIRST_HOUR', 4200),
        minuteRate: this.getConfigNumber('PREMIUM_MINUTE_RATE', 70),
        airports: {
          SVO: this.getConfigNumber('PREMIUM_AIRPORT_SVO', 6000),
          DME: this.getConfigNumber('PREMIUM_AIRPORT_DME', 7000),
          VKO: this.getConfigNumber('PREMIUM_AIRPORT_VKO', 6000)
        }
      },
      [CarClass.ELITE]: {
        firstHour: this.getConfigNumber('ELITE_FIRST_HOUR', 4800),
        minuteRate: this.getConfigNumber('ELITE_MINUTE_RATE', 80),
        airports: {
          SVO: this.getConfigNumber('ELITE_AIRPORT_SVO', 7000),
          DME: this.getConfigNumber('ELITE_AIRPORT_DME', 8000),
          VKO: this.getConfigNumber('ELITE_AIRPORT_VKO', 7000)
        }
      }
    };

    // Инициализация скидок для почасовой аренды
    this.hourlyDiscounts = [
      { hours: 12, discount: this.getConfigNumber('DISCOUNT_12_HOURS', 30) },
      { hours: 10, discount: this.getConfigNumber('DISCOUNT_10_HOURS', 25) },
      { hours: 8, discount: this.getConfigNumber('DISCOUNT_8_HOURS', 20) },
      { hours: 6, discount: this.getConfigNumber('DISCOUNT_6_HOURS', 15) },
      { hours: 4, discount: this.getConfigNumber('DISCOUNT_4_HOURS', 10) },
      { hours: 2, discount: this.getConfigNumber('DISCOUNT_2_HOURS', 5) }
    ].sort((a, b) => b.hours - a.hours); // Сортировка по убыванию часов

    this.commissionRate = this.getConfigNumber('COMMISSION_RATE', 25) / 100;
  }

  calculatePrice(
    type: OrderType,
    carClass: CarClass,
    durationHours?: number,
    airport?: 'SVO' | 'DME' | 'VKO'
  ): PriceCalculation {
    const config = this.priceConfigs[carClass];

    switch (type) {
      case OrderType.AIRPORT:
        if (!airport) {
          throw new BadRequestException('Не указан код аэропорта для трансфера');
        }
        return {
          basePrice: config.airports[airport],
          discount: 0,
          finalPrice: config.airports[airport]
        };

      case OrderType.HOURLY:
        if (!durationHours || durationHours < 2 || durationHours > 12) {
          throw new BadRequestException('Некорректная длительность аренды');
        }
        const basePrice = config.firstHour * durationHours;
        const discount = this.calculateHourlyDiscount(durationHours, basePrice);
        return {
          basePrice,
          discount,
          finalPrice: basePrice - discount
        };

      case OrderType.PRE_ORDER:
        const preOrderPrice = config.firstHour;
        const extraMinutes = durationHours && durationHours > 1 
          ? (durationHours - 1) * 60 
          : 0;
        const extraPrice = extraMinutes * (config.minuteRate / 60);
        const totalPrice = preOrderPrice + extraPrice;

        return {
          basePrice: totalPrice,
          discount: 0,
          finalPrice: totalPrice
        };

      default:
        throw new BadRequestException(`Неподдерживаемый тип заказа: ${type}`);
    }
  }

  calculateCommission(price: number): number {
    return Math.round(price * this.commissionRate);
  }

  private calculateHourlyDiscount(hours: number, basePrice: number): number {
    const applicableDiscount = this.hourlyDiscounts.find(d => hours >= d.hours);
    if (!applicableDiscount) {
      return 0;
    }
    return Math.round(basePrice * (applicableDiscount.discount / 100));
  }

  private getConfigNumber(key: string, defaultValue: number): number {
    const value = this.configService.get<number>(key);
    return value !== undefined ? value : defaultValue;
  }

  getHourlyDiscounts(): HourlyDiscount[] {
    return [...this.hourlyDiscounts];
  }

  getPriceEstimate(
    type: OrderType,
    carClass: CarClass,
    durationHours?: number,
    airport?: 'SVO' | 'DME' | 'VKO'
  ): {
    basePrice: number;
    discount: number;
    finalPrice: number;
    commission: number;
  } {
    const calculation = this.calculatePrice(type, carClass, durationHours, airport);
    const commission = this.calculateCommission(calculation.finalPrice);

    return {
      ...calculation,
      commission
    };
  }
}