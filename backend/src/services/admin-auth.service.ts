import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../entities/admin-user.entity';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminRepository: Repository<AdminUser>,
    private jwtService: JwtService
  ) {}

  async validateAdmin(email: string, password: string) {
    const admin = await this.adminRepository.findOne({
      where: { email }
    });

    if (admin && await bcrypt.compare(password, admin.password)) {
      const { password, ...result } = admin;
      return result;
    }
    return null;
  }

  async login(admin: AdminUser) {
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

    if (!await bcrypt.compare(currentPassword, admin.password)) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await this.adminRepository.save(admin);

    return { message: 'Password successfully changed' };
  }
}