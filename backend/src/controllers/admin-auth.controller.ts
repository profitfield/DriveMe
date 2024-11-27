import { Controller, Post, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminLoginDto, ChangePasswordDto } from '../dto/admin.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() loginDto: AdminLoginDto) {
    const admin = await this.adminAuthService.validateAdmin(
      loginDto.email, 
      loginDto.password
    );

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.adminAuthService.login(admin);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change admin password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.adminAuthService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword
    );
  }
}