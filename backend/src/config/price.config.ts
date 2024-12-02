import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CarClass } from '../entities/driver.entity';

@Injectable()
export class PriceConfigService {
  constructor(private configService: ConfigService) {}

  getPriceConfig(carClass: CarClass) {
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

  getHourlyDiscount(hours: number): number {
    if (hours >= 12) return this.configService.get<number>('DISCOUNT_12_HOURS');
    if (hours >= 10) return this.configService.get<number>('DISCOUNT_10_HOURS');
    if (hours >= 8) return this.configService.get<number>('DISCOUNT_8_HOURS');
    if (hours >= 6) return this.configService.get<number>('DISCOUNT_6_HOURS');
    if (hours >= 4) return this.configService.get<number>('DISCOUNT_4_HOURS');
    if (hours >= 2) return this.configService.get<number>('DISCOUNT_2_HOURS');
    return 0;
  }
}