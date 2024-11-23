import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { AdminRole } from '../entities/admin-user.entity';
import { DriverStatus } from '../entities/driver.entity';
import { 
  CreateAdminDto, 
  UpdateAdminDto,
  UpdateDriverStatusDto,
  OrderFiltersDto,
  DriverFiltersDto 
} from '../dto/admin.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Admin Users Management
  @Post('users')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new admin user' })
  @ApiResponse({ status: 201, description: 'Admin created successfully' })
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.createAdmin(createAdminDto);
  }

  @Put('users/:id')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update admin user' })
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto
  ) {
    return this.adminService.updateAdmin(id, updateAdminDto);
  }

  // Orders Management
  @Get('orders')
  @Roles(AdminRole.ADMIN, AdminRole.OPERATOR)
  @ApiOperation({ summary: 'Get all orders with filters' })
  async getOrders(@Query() filters: OrderFiltersDto) {
    return this.adminService.getOrders(filters);
  }

  @Get('orders/:id')
  @Roles(AdminRole.ADMIN, AdminRole.OPERATOR)
  @ApiOperation({ summary: 'Get order details' })
  async getOrderDetails(@Param('id') id: string) {
    return this.adminService.getOrderDetails(id);
  }

  // Drivers Management
  @Get('drivers')
  @Roles(AdminRole.ADMIN, AdminRole.OPERATOR)
  @ApiOperation({ summary: 'Get all drivers with filters' })
  async getDrivers(@Query() filters: DriverFiltersDto) {
    return this.adminService.getDrivers(filters);
  }

  @Put('drivers/:id/status')
  @Roles(AdminRole.ADMIN)
  @ApiOperation({ summary: 'Update driver status' })
  async updateDriverStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateDriverStatusDto
  ) {
    return this.adminService.updateDriverStatus(
      id,
      updateStatusDto.status,
      updateStatusDto.adminId
    );
  }

  // Statistics
  @Get('statistics')
  @Roles(AdminRole.ADMIN, AdminRole.FINANCE)
  @ApiOperation({ summary: 'Get system statistics' })
  async getStatistics(@Query('period') period: string) {
    return this.adminService.getStatistics(period);
  }

  // Settings Management
  @Get('settings')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Get all system settings' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings/:key')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update system setting' })
  async updateSettings(
    @Param('key') key: string,
    @Body('value') value: any,
    @Body('adminId') adminId: string
  ) {
    return this.adminService.updateSettings(key, value, adminId);
  }

  // System Logs
  @Get('logs')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get system logs' })
  async getLogs(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type?: string
  ) {
    return this.adminService.getLogs(startDate, endDate, type);
  }
}