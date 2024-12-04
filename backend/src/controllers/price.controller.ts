// src/controllers/price.controller.ts

import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PriceService } from '../services/price.service';
import { CalculatePriceDto, PriceResponseDto } from '../dto/price.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import { HourlyDiscount } from '../interfaces/price.interface';

@ApiTags('prices')
@Controller('prices')
@UseGuards(JwtAuthGuard)
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Post('calculate')
  @Public()
  @ApiOperation({ summary: 'Рассчитать стоимость поездки' })
  @ApiResponse({ 
    status: 200, 
    type: PriceResponseDto,
    description: 'Расчет стоимости успешно выполнен' 
  })
  calculatePrice(@Body() calculatePriceDto: CalculatePriceDto): PriceResponseDto {
    return this.priceService.getPriceEstimate(
      calculatePriceDto.type,
      calculatePriceDto.carClass,
      calculatePriceDto.durationHours,
      calculatePriceDto.airport
    );
  }

  @Get('hourly-discounts')
  @Public()
  @ApiOperation({ summary: 'Получить информацию о скидках на почасовую аренду' })
  getHourlyDiscounts(): HourlyDiscount[] {
    return this.priceService.getHourlyDiscounts();
  }
}