import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../entities/admin-user.entity';

interface AdminAuthResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: AdminRole;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminRepository: Repository<AdminUser>,
    private jwtService: JwtService
  ) {}

  async validateAdmin(email: string, password: string): Promise<AdminAuthResponse | null> {
    const admin = await this.adminRepository.findOne({
      where: { email }
    });

    if (!admin) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = admin;
    return result;
  }

  async login(admin: AdminAuthResponse) {
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role
    };

    return {
      access_token: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName
      }
    };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId }
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (newPassword.length < 6) {
      throw new UnauthorizedException('New password must be at least 6 characters long');
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await this.adminRepository.save(admin);

    return { message: 'Password successfully changed' };
  }

  async verifyToken(token: string): Promise<AdminAuthResponse> {
    try {
      const decoded = this.jwtService.verify(token);
      const admin = await this.adminRepository.findOne({
        where: { id: decoded.sub }
      });

      if (!admin) {
        throw new UnauthorizedException('Admin not found');
      }

      const { password: _, ...result } = admin;
      return result;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}