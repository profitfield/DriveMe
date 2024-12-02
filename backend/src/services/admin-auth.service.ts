// src/services/admin-auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminAuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async validateAdmin(email: string, password: string) {
    // Для MVP храним одного админа в переменных окружения
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (email !== adminEmail) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, adminPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      email,
      isAdmin: true,
      role: 'admin'
    };
  }

  async login(email: string, password: string) {
    const admin = await this.validateAdmin(email, password);

    const payload = { 
      email: admin.email, 
      isAdmin: true, 
      role: admin.role 
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}