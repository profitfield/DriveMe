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
    timeBasedPricing: TimeBasedPricing;
    pricingRules: PricingRules;
}

export interface PriceCalculation {
    basePrice: number;
    discount: number;
    finalPrice: number;
    commission?: number;
    additionalCharges?: AdditionalCharge[];
    priceModifiers?: PriceModifier[];
    breakdown?: PriceBreakdown;
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
    pickupDateTime?: Date;
    isHoliday?: boolean;
    additionalStops?: number;
    expectedWaitingTime?: number;
}

export interface PriceEstimateResult extends PriceCalculation {
    commission: number;
    discountPercentage?: number;
    details: {
        hourlyRate?: number;
        extraMinutesCharge?: number;
        appliedDiscount?: HourlyDiscount;
        nightRateApplied?: boolean;
        holidayRateApplied?: boolean;
    };
}

export interface CarClassPricing {
    [CarClass.PREMIUM]: PriceConfiguration;
    [CarClass.PREMIUM_LARGE]: PriceConfiguration;
    [CarClass.ELITE]: PriceConfiguration;
}

export interface CommissionConfig {
    rate: number;          // Процент комиссии (например, 0.25 для 25%)
    minimumAmount?: number; // Минимальная сумма комиссии
    maxAmount?: number;     // Максимальная сумма комиссии
}

export interface TimeBasedPricing {
    nightRateMultiplier: number;    // Множитель для ночного тарифа
    holidayRateMultiplier: number;  // Множитель для праздничных дней
    nightHoursStart: number;        // Час начала ночного тарифа (0-23)
    nightHoursEnd: number;          // Час окончания ночного тарифа (0-23)
}

export interface PricingRules {
    minOrderDuration: number;       // Минимальная длительность заказа в часах
    maxOrderDuration: number;       // Максимальная длительность заказа в часах
    cancellationFee: number;        // Процент от стоимости при отмене
    waitingRate: number;            // Стоимость ожидания в минуту
    extraStopRate: number;          // Стоимость дополнительной остановки
    minPrice: number;               // Минимальная стоимость заказа
    maxDiscount: number;            // Максимальная скидка в процентах
}

export interface AdditionalCharge {
    type: 'WAITING' | 'EXTRA_STOP' | 'NIGHT_RATE' | 'HOLIDAY_RATE';
    amount: number;
    description: string;
}

export interface PriceModifier {
    type: 'INCREASE' | 'DISCOUNT';
    value: number;
    description: string;
}

export interface PriceBreakdown {
    baseAmount: number;             // Базовая стоимость
    discountAmount: number;         // Сумма скидки
    additionalChargesAmount: number; // Сумма дополнительных расходов
    modifiersAmount: number;        // Сумма модификаторов цены
    commissionAmount: number;       // Сумма комиссии
    finalAmount: number;            // Итоговая сумма
}