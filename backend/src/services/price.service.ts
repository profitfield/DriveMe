// src/services/price.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PriceConfigService } from '../config/price.config';
import { CarClass } from '../entities/driver.entity';
import { OrderType } from '../entities/order.entity';
import {
    PriceCalculation,
    HourlyDiscount,
    PriceEstimateParams,
    PriceEstimateResult,
    AdditionalCharge,
    PriceModifier,
    PriceBreakdown
} from '../interfaces/price.interface';

@Injectable()
export class PriceService {
    constructor(private readonly priceConfigService: PriceConfigService) {}

    calculatePrice(
        type: OrderType,
        carClass: CarClass,
        durationHours?: number,
        airport?: 'SVO' | 'DME' | 'VKO',
        params?: Partial<PriceEstimateParams>
    ): PriceCalculation {
        const config = this.priceConfigService.getPriceConfig(carClass);
        const rules = config.pricingRules;

        let calculation: PriceCalculation;

        switch (type) {
            case OrderType.AIRPORT:
                if (!airport) {
                    throw new BadRequestException('Airport code is required for airport transfer');
                }
                const airportPrice = config.airports[airport];
                calculation = {
                    basePrice: airportPrice,
                    discount: 0,
                    finalPrice: airportPrice,
                    commission: this.calculateCommission(airportPrice),
                    breakdown: {
                        baseAmount: airportPrice,
                        discountAmount: 0,
                        additionalChargesAmount: 0,
                        modifiersAmount: 0,
                        commissionAmount: this.calculateCommission(airportPrice),
                        finalAmount: airportPrice
                    }
                };
                break;

            case OrderType.HOURLY:
                if (!durationHours || durationHours < rules.minOrderDuration || durationHours > rules.maxOrderDuration) {
                    throw new BadRequestException(
                        `Duration must be between ${rules.minOrderDuration} and ${rules.maxOrderDuration} hours`
                    );
                }
                const hourlyBasePrice = config.firstHour * durationHours;
                const hourlyDiscount = this.calculateHourlyDiscount(durationHours, hourlyBasePrice);
                const hourlyFinalPrice = hourlyBasePrice - hourlyDiscount;
                calculation = {
                    basePrice: hourlyBasePrice,
                    discount: hourlyDiscount,
                    finalPrice: hourlyFinalPrice,
                    commission: this.calculateCommission(hourlyFinalPrice),
                    breakdown: {
                        baseAmount: hourlyBasePrice,
                        discountAmount: hourlyDiscount,
                        additionalChargesAmount: 0,
                        modifiersAmount: 0,
                        commissionAmount: this.calculateCommission(hourlyFinalPrice),
                        finalAmount: hourlyFinalPrice
                    }
                };
                break;

            case OrderType.PRE_ORDER:
                const preOrderBasePrice = config.firstHour;
                const extraMinutes = durationHours && durationHours > 1 
                    ? (durationHours - 1) * 60 
                    : 0;
                const extraPrice = extraMinutes * (config.minuteRate / 60);
                const totalPreOrderPrice = preOrderBasePrice + extraPrice;
                calculation = {
                    basePrice: totalPreOrderPrice,
                    discount: 0,
                    finalPrice: totalPreOrderPrice,
                    commission: this.calculateCommission(totalPreOrderPrice),
                    breakdown: {
                        baseAmount: totalPreOrderPrice,
                        discountAmount: 0,
                        additionalChargesAmount: 0,
                        modifiersAmount: 0,
                        commissionAmount: this.calculateCommission(totalPreOrderPrice),
                        finalAmount: totalPreOrderPrice
                    }
                };
                break;

            default:
                throw new BadRequestException(`Unsupported order type: ${type}`);
        }

        const { additionalCharges, priceModifiers } = this.calculateAdditionalCharges(
            calculation.finalPrice,
            params,
            config
        );

        const additionalChargesAmount = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
        const modifiersAmount = priceModifiers.reduce(
            (sum, modifier) => sum + (modifier.type === 'INCREASE' ? modifier.value : -modifier.value),
            0
        );

        const finalPrice = Math.max(
            rules.minPrice,
            calculation.finalPrice + additionalChargesAmount + modifiersAmount
        );

        const commission = this.calculateCommission(finalPrice);

        return {
            ...calculation,
            additionalCharges,
            priceModifiers,
            finalPrice,
            commission,
            breakdown: {
                ...calculation.breakdown,
                additionalChargesAmount,
                modifiersAmount,
                commissionAmount: commission,
                finalAmount: finalPrice
            }
        };
    }

    getPriceEstimate(params: PriceEstimateParams): PriceEstimateResult {
        const calculation = this.calculatePrice(
            params.type,
            params.carClass,
            params.durationHours,
            params.airport,
            params
        );

        const discountPercentage = calculation.basePrice > 0
            ? (calculation.discount / calculation.basePrice) * 100
            : 0;

        // Убеждаемся, что commission всегда определен
        const commission = calculation.commission || this.calculateCommission(calculation.finalPrice);

        return {
            ...calculation,
            commission,
            discountPercentage,
            details: {
                hourlyRate: params.type === OrderType.HOURLY ? this.priceConfigService.getPriceConfig(params.carClass).firstHour : undefined,
                extraMinutesCharge: calculation.priceModifiers?.find(m => m.type === 'INCREASE')?.value,
                appliedDiscount: discountPercentage > 0 ? { 
                    hours: params.durationHours || 0,
                    discount: discountPercentage
                } : undefined,
                nightRateApplied: calculation.additionalCharges?.some(c => c.type === 'NIGHT_RATE') || false,
                holidayRateApplied: calculation.additionalCharges?.some(c => c.type === 'HOLIDAY_RATE') || false
            }
        };
    }

    public calculateCommission(price: number): number {
        const commissionConfig = this.priceConfigService.getCommissionConfig();
        
        let commission = Math.round(price * commissionConfig.rate);

        if (commissionConfig.minimumAmount) {
            commission = Math.max(commission, commissionConfig.minimumAmount);
        }

        if (commissionConfig.maxAmount) {
            commission = Math.min(commission, commissionConfig.maxAmount);
        }

        return commission;
    }

    private calculateHourlyDiscount(hours: number, basePrice: number): number {
        const discountPercentage = this.priceConfigService.getHourlyDiscount(hours);
        if (!discountPercentage) {
            return 0;
        }
        
        const maxDiscount = this.priceConfigService.getPriceConfig(CarClass.PREMIUM).pricingRules.maxDiscount;
        const actualDiscount = Math.min(discountPercentage, maxDiscount);
        
        return Math.round(basePrice * (actualDiscount / 100));
    }

    private calculateAdditionalCharges(
        basePrice: number,
        params?: Partial<PriceEstimateParams>,
        config?: any
    ): { additionalCharges: AdditionalCharge[]; priceModifiers: PriceModifier[] } {
        const additionalCharges: AdditionalCharge[] = [];
        const priceModifiers: PriceModifier[] = [];

        if (!params || !config) {
            return { additionalCharges, priceModifiers };
        }

        if (params.pickupDateTime) {
            const hour = params.pickupDateTime.getHours();
            if (hour >= config.timeBasedPricing.nightHoursStart || hour < config.timeBasedPricing.nightHoursEnd) {
                const nightCharge = basePrice * (config.timeBasedPricing.nightRateMultiplier - 1);
                additionalCharges.push({
                    type: 'NIGHT_RATE',
                    amount: nightCharge,
                    description: 'Night rate surcharge'
                });
            }
        }

        if (params.isHoliday) {
            const holidayCharge = basePrice * (config.timeBasedPricing.holidayRateMultiplier - 1);
            additionalCharges.push({
                type: 'HOLIDAY_RATE',
                amount: holidayCharge,
                description: 'Holiday rate surcharge'
            });
        }

        if (params.additionalStops && params.additionalStops > 0) {
            additionalCharges.push({
                type: 'EXTRA_STOP',
                amount: params.additionalStops * config.pricingRules.extraStopRate,
                description: `${params.additionalStops} additional stops`
            });
        }

        if (params.expectedWaitingTime && params.expectedWaitingTime > 0) {
            additionalCharges.push({
                type: 'WAITING',
                amount: params.expectedWaitingTime * config.pricingRules.waitingRate,
                description: `${params.expectedWaitingTime} minutes waiting time`
            });
        }

        return { additionalCharges, priceModifiers };
    }

    getHourlyDiscounts(): HourlyDiscount[] {
        return Object.entries(this.priceConfigService.getHourlyDiscount(0))
            .map(([hours, discount]) => ({
                hours: parseInt(hours),
                discount
            }))
            .sort((a, b) => b.hours - a.hours);
    }
}