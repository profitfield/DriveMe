import { Injectable } from '@nestjs/common';
import { CarClass } from '../entities/driver.entity';
import { OrderType } from '../entities/order.entity';
import { PriceCalculation, CarClassPrices } from '../interfaces/price.interface';

@Injectable()
export class PriceService {
  private readonly prices: Record<CarClass, CarClassPrices> = {
    [CarClass.PREMIUM]: {
      firstHour: 4200,
      minuteRate: 70,
      airports: {
        SVO: 6000,
        DME: 7000,
        VKO: 6000
      }
    },
    [CarClass.PREMIUM_LARGE]: {
      firstHour: 4200,
      minuteRate: 70,
      airports: {
        SVO: 6000,
        DME: 7000,
        VKO: 6000
      }
    },
    [CarClass.ELITE]: {
      firstHour: 4800,
      minuteRate: 80,
      airports: {
        SVO: 7000,
        DME: 8000,
        VKO: 7000
      }
    }
  };

  private readonly hourlyDiscounts = [
    { hours: 2, discount: 0.05 },  // 5%
    { hours: 4, discount: 0.10 },  // 10%
    { hours: 6, discount: 0.15 },  // 15%
    { hours: 8, discount: 0.20 },  // 20%
    { hours: 10, discount: 0.25 }, // 25%
    { hours: 12, discount: 0.30 }  // 30%
  ];

  calculatePrice(
    type: OrderType,
    carClass: CarClass,
    durationHours?: number,
    airport?: 'SVO' | 'DME' | 'VKO'
  ): PriceCalculation {
    const prices = this.prices[carClass];

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

      case OrderType.PRE_ORDER:
        const basePrice = prices.firstHour;
        const extraMinutes = durationHours && durationHours > 1 
          ? (durationHours - 1) * 60 
          : 0;
        const extraPrice = extraMinutes * prices.minuteRate;
        const totalPrice = basePrice + extraPrice;

        return {
          basePrice: totalPrice,
          discount: 0,
          finalPrice: totalPrice
        };

      case OrderType.HOURLY:
        if (!durationHours) {
          throw new Error('Duration is required for hourly orders');
        }
        const hourlyBasePrice = prices.firstHour * durationHours;
        const discountPercent = this.getHourlyDiscount(durationHours);
        const discountAmount = hourlyBasePrice * discountPercent;
        const hourlyFinalPrice = hourlyBasePrice - discountAmount;

        return {
          basePrice: hourlyBasePrice,
          discount: discountAmount,
          finalPrice: hourlyFinalPrice
        };

      default:
        throw new Error(`Unsupported order type: ${type}`);
    }
  }

  calculateCommission(price: number): number {
    const commissionRate = 0.25; // 25%
    return Math.round(price * commissionRate);
  }

  private getHourlyDiscount(hours: number): number {
    const discount = this.hourlyDiscounts
      .reverse()
      .find(d => hours >= d.hours);
    return discount ? discount.discount : 0;
  }
}