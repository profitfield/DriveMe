// src/controllers/drivers.controller.ts

import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Param, 
  Body, 
  Query, 
  UseGuards, 
  Request,
  ParseEnumPipe,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DriversService } from '../services/drivers.service';
import { 
  CreateDriverDto, 
  UpdateDriverStatusDto, 
  UpdateLocationDto,
  DriverResponseDto,
  DriverStatsDto
} from '../dto/driver.dto';
import { CarClass, Driver, DriverStatus } from '../entities/driver.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { rateLimitConfig } from '../config/rate-limit.config';

@ApiTags('drivers')
@Controller('drivers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Register as a driver' })
  @ApiResponse({ 
    status: 201, 
    description: 'Driver successfully registered',
    type: DriverResponseDto 
  })
  async createDriver(
    @Request() req,
    @Body() createDriverDto: CreateDriverDto
  ): Promise<Driver> {
    return this.driversService.create({
      ...createDriverDto,
      userId: req.user.userId
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current driver profile' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns driver profile',
    type: DriverResponseDto 
  })
  async getCurrentDriver(@Request() req): Promise<Driver> {
    const driver = await this.driversService.findByUserId(req.user.userId);
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get driver statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns driver statistics',
    type: DriverStatsDto 
  })
  async getDriverStats(@Request() req) {
    const driver = await this.driversService.findByUserId(req.user.userId);
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return this.driversService.getDriverStatistics(driver.id);
  }

  @Patch('me/status')
  @ApiOperation({ summary: 'Update driver status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Status successfully updated',
    type: DriverResponseDto 
  })
  @RateLimit(rateLimitConfig.drivers.status)
  async updateStatus(
    @Request() req,
    @Body() updateStatusDto: UpdateDriverStatusDto
  ): Promise<Driver> {
    const driver = await this.driversService.findByUserId(req.user.userId);
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return this.driversService.updateStatus(driver.id, updateStatusDto.status);
  }

  @Post('me/location')
  @ApiOperation({ summary: 'Update driver location' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location updated successfully' 
  })
  @RateLimit(rateLimitConfig.drivers.location)
  async updateLocation(
    @Request() req,
    @Body() locationDto: UpdateLocationDto
  ): Promise<void> {
    const driver = await this.driversService.findByUserId(req.user.userId);
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    await this.driversService.updateLocation(
      driver.id,
      locationDto.latitude,
      locationDto.longitude
    );
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available drivers by car class' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of available drivers',
    type: [DriverResponseDto] 
  })
  @ApiQuery({ name: 'carClass', enum: CarClass })
  async getAvailableDrivers(
    @Query('carClass', new ParseEnumPipe(CarClass)) carClass: CarClass
  ): Promise<Driver[]> {
    return this.driversService.getAvailableDrivers(carClass);
  }

  @Get(':id/rating')
  @ApiOperation({ summary: 'Update driver rating' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rating updated successfully',
    type: DriverResponseDto
  })
  async updateRating(
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Request() req
  ): Promise<Driver> {
    // Проверяем, что клиент имел поездку с этим водителем
    const driver = await this.driversService.findById(id);
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.driversService.updateDriverRating(id, rating);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active drivers' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns list of active drivers',
    type: [DriverResponseDto]
  })
  async getActiveDrivers(): Promise<Driver[]> {
    return this.driversService.getActiveDrivers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get driver by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns driver details',
    type: DriverResponseDto
  })
  async getDriver(@Param('id') id: string): Promise<Driver> {
    return this.driversService.findById(id);
  }
}