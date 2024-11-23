import { 
    Controller, 
    Get, 
    Post, 
    Patch, 
    Param, 
    Body, 
    Query,
    ParseEnumPipe,
    NotFoundException 
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
  import { DriversService } from '../services/drivers.service';
  import { CreateDriverDto, UpdateDriverStatusDto } from '../dto/driver.dto';
  import { CarClass } from '../entities/driver.entity';
  
  @ApiTags('drivers')
  @Controller('drivers')
  export class DriversController {
    constructor(private readonly driversService: DriversService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new driver' })
    @ApiResponse({ status: 201, description: 'Driver successfully created' })
    async createDriver(@Body() createDriverDto: CreateDriverDto) {
      return this.driversService.create(createDriverDto);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get driver by ID' })
    @ApiResponse({ status: 200, description: 'Return driver details' })
    async getDriver(@Param('id') id: string) {
      return this.driversService.findById(id);
    }
  
    @Patch(':id/status')
    @ApiOperation({ summary: 'Update driver status' })
    @ApiResponse({ status: 200, description: 'Status successfully updated' })
    async updateStatus(
      @Param('id') id: string,
      @Body() updateStatusDto: UpdateDriverStatusDto
    ) {
      return this.driversService.updateStatus(id, updateStatusDto.status);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get available drivers by car class' })
    @ApiResponse({ status: 200, description: 'Return list of available drivers' })
    @ApiQuery({ name: 'carClass', enum: CarClass })
    async getAvailableDrivers(
      @Query('carClass', new ParseEnumPipe(CarClass)) carClass: CarClass
    ) {
      return this.driversService.getAvailableDrivers(carClass);
    }
  
    @Get('user/:userId')
    @ApiOperation({ summary: 'Get driver by user ID' })
    @ApiResponse({ status: 200, description: 'Return driver details' })
    async getDriverByUserId(@Param('userId') userId: string) {
      const driver = await this.driversService.findByUserId(userId);
      if (!driver) {
        throw new NotFoundException('Driver not found');
      }
      return driver;
    }
  }