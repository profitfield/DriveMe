// src/config/price.config.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CarClass } from '../entities/driver.entity';
import { 
    PriceConfiguration,
    TimeBasedPricing,
    PricingRules,
    CommissionConfig
} from '../interfaces/price.interface';

@Injectable()
export class PriceConfigService {
    constructor(private configService: ConfigService) {}

    getPriceConfig(carClass: CarClass): PriceConfiguration {
        return {
            ...this.getBaseConfig(carClass),
            timeBasedPricing: this.getTimeBasedPricing(carClass),
            pricingRules: this.getPricingRules(carClass)
        };
    }

    private getBaseConfig(carClass: CarClass) {
        switch (carClass) {
            case CarClass.PREMIUM:
            case CarClass.PREMIUM_LARGE:
                return {
                    firstHour: this.configService.get<number>('PREMIUM_FIRST_HOUR'),
                    minuteRate: this.configService.get<number>('PREMIUM_MINUTE_RATE'),
                    airports: {
                        SVO: this.configService.get<number>('PREMIUM_AIRPORT_SVO'),
                        DME: this.configService.get<number>('PREMIUM_AIRPORT_DME'),
                        VKO: this.configService.get<number>('PREMIUM_AIRPORT_VKO'),
                    }
                };
            case CarClass.ELITE:
                return {
                    firstHour: this.configService.get<number>('ELITE_FIRST_HOUR'),
                    minuteRate: this.configService.get<number>('ELITE_MINUTE_RATE'),
                    airports: {
                        SVO: this.configService.get<number>('ELITE_AIRPORT_SVO'),
                        DME: this.configService.get<number>('ELITE_AIRPORT_DME'),
                        VKO: this.configService.get<number>('ELITE_AIRPORT_VKO'),
                    }
                };
            default:
                throw new Error(`Unknown car class: ${carClass}`);
        }
    }

    private getTimeBasedPricing(carClass: CarClass): TimeBasedPricing {
        const baseMultiplier = carClass === CarClass.ELITE ? 1.5 : 1.3;
        return {
            nightRateMultiplier: this.configService.get<number>('NIGHT_RATE_MULTIPLIER') || baseMultiplier,
            holidayRateMultiplier: this.configService.get<number>('HOLIDAY_RATE_MULTIPLIER') || baseMultiplier + 0.2,
            nightHoursStart: this.configService.get<number>('NIGHT_HOURS_START') || 23,
            nightHoursEnd: this.configService.get<number>('NIGHT_HOURS_END') || 6
        };
    }

    private getPricingRules(carClass: CarClass): PricingRules {
        const isElite = carClass === CarClass.ELITE;
        return {
            minOrderDuration: this.configService.get<number>('MIN_ORDER_DURATION') || 1,
            maxOrderDuration: this.configService.get<number>('MAX_ORDER_DURATION') || 12,
            cancellationFee: this.configService.get<number>('CANCELLATION_FEE') || 20,
            waitingRate: this.configService.get<number>(isElite ? 'ELITE_WAITING_RATE' : 'PREMIUM_WAITING_RATE') || (isElite ? 100 : 80),
            extraStopRate: this.configService.get<number>(isElite ? 'ELITE_EXTRA_STOP_RATE' : 'PREMIUM_EXTRA_STOP_RATE') || (isElite ? 500 : 400),
            minPrice: this.configService.get<number>(isElite ? 'ELITE_MIN_PRICE' : 'PREMIUM_MIN_PRICE') || (isElite ? 4800 : 4200),
            maxDiscount: this.configService.get<number>('MAX_DISCOUNT') || 30
        };
    }

    getHourlyDiscount(hours: number): number {
        if (hours >= 12) return this.configService.get<number>('DISCOUNT_12_HOURS');
        if (hours >= 10) return this.configService.get<number>('DISCOUNT_10_HOURS');
        if (hours >= 8) return this.configService.get<number>('DISCOUNT_8_HOURS');
        if (hours >= 6) return this.configService.get<number>('DISCOUNT_6_HOURS');
        if (hours >= 4) return this.configService.get<number>('DISCOUNT_4_HOURS');
        if (hours >= 2) return this.configService.get<number>('DISCOUNT_2_HOURS');
        return 0;
    }

    getCommissionConfig(): CommissionConfig {
        return {
            rate: this.configService.get<number>('COMMISSION_RATE') || 0.25,
            minimumAmount: this.configService.get<number>('MIN_COMMISSION_AMOUNT'),
            maxAmount: this.configService.get<number>('MAX_COMMISSION_AMOUNT')
        };
    }
}