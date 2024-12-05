// backend/src/controllers/telegram.controller.ts

import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegramService } from '../services/telegram.service';
import { Update } from 'telegraf/typings/core/types/typegram';
import { Public } from '../decorators/public.decorator';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
    private readonly logger = new Logger(TelegramController.name);

    constructor(private readonly telegramService: TelegramService) {}

    @Public()
    @Post('webhook')
    @HttpCode(200)
    @ApiOperation({ summary: 'Handle Telegram webhook updates' })
    @ApiResponse({ 
        status: 200, 
        description: 'Update processed successfully' 
    })
    async handleWebhook(@Body() update: Update): Promise<void> {
        try {
            this.logger.debug(`Received Telegram update: ${JSON.stringify(update)}`);
            await this.telegramService.handleUpdate(update);
        } catch (error) {
            this.logger.error(
                `Error handling Telegram update: ${error.message}`, 
                error.stack
            );
            // Не пробрасываем ошибку дальше, чтобы Telegram получил 200 OK
            // и не пытался переотправить это же обновление
        }
    }
}