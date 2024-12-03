// src/controllers/telegram.controller.ts

import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegramService } from '../services/telegram.service';
import { Update } from 'telegraf/typings/core/types/typegram';
import { Public } from '../decorators/public.decorator';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Telegram webhook updates' })
  @ApiResponse({ status: 200, description: 'Update processed successfully' })
  async handleWebhook(@Body() update: Update): Promise<void> {
    await this.telegramService.handleUpdate(update);
  }
}