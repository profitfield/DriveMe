// src/interfaces/price.interface.ts

import { CarClass } from '../entities/driver.entity';
import { OrderType } from '../entities/order.entity';

export interface PriceConfiguration {
  firstHour: number;
  minuteRate: number;
  airports: {
    SVO: number;
    DME: number;
    VKO: number;
  };
}

export interface PriceCalculation {
  basePrice: number;
  discount: number;
  finalPrice: number;
  commission?: number;
}

export interface HourlyDiscount {
  hours: number;
  discount: number;
}

export interface PriceEstimateParams {
  type: OrderType;
  carClass: CarClass;
  durationHours?: number;
  airport?: 'SVO' | 'DME' | 'VKO';
}

export interface PriceEstimateResult extends PriceCalculation {
  commission: number;
  discountPercentage?: number;
  details?: {
    hourlyRate?: number;
    extraMinutesCharge?: number;
    appliedDiscount?: HourlyDiscount;
  };
}

export interface CarClassPricing {
  [CarClass.PREMIUM]: PriceConfiguration;
  [CarClass.PREMIUM_LARGE]: PriceConfiguration;
  [CarClass.ELITE]: PriceConfiguration;
}

export interface CommissionConfig {
  rate: number;          // Процент комиссии (например, 0.25 для 25%)
  minimumAmount?: number; // Минимальная сумма комиссии, если применимо
}