// backend/src/modules/telegram.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from '../services/telegram.service';
import { TelegramController } from '../controllers/telegram.controller';

@Module({
  imports: [ConfigModule],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}