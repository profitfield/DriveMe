// src/controllers/admin-auth.controller.ts

import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from '../services/admin-auth.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('admin')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuthService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  async login(
    @Body() credentials: { email: string; password: string }
  ) {
    try {
      return await this.adminAuthService.login(
        credentials.email,
        credentials.password
      );
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}