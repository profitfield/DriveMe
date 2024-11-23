import { OrderType } from '../entities/order.entity';
import { CarClass } from '../entities/driver.entity';

export interface PriceCalculation {
  basePrice: number;
  discount: number;
  finalPrice: number;
}

export interface AirportPrices {
  SVO: number;
  DME: number;
  VKO: number;
}

export interface CarClassPrices {
  firstHour: number;
  minuteRate: number;
  airports: AirportPrices;
}

export interface HourlyDiscount {
  hours: number;
  discount: number;
}