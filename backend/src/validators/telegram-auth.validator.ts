// src/validators/telegram-auth.validator.ts

import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TelegramLoginDto } from '../dto/auth.dto';

@Injectable()
export class TelegramAuthValidator {
  constructor(private configService: ConfigService) {}

  validateTelegramAuth(data: TelegramLoginDto): boolean {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    if (Math.abs(Date.now() / 1000 - data.auth_date) > 86400) {
      return false;
    }

    const checkString = Object.entries(data)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHash('sha256')
      .update(botToken)
      .digest();

    const hash = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    return hash === data.hash;
  }
}