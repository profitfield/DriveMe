// src/services/telegram.service.ts

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly configService: ConfigService
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    this.bot = new Telegraf(token);
  }

  async onModuleInit() {
    this.setupCommands();
    this.setupHandlers();
    await this.startBot();
  }

  async onModuleDestroy() {
    await this.bot.stop();
  }

  private setupCommands() {
    this.bot.command('start', this.handleStartCommand.bind(this));
    this.bot.command('help', this.handleHelpCommand.bind(this));
    this.bot.command('profile', this.handleProfileCommand.bind(this));
    this.bot.command('orders', this.handleOrdersCommand.bind(this));
    this.bot.command('support', this.handleSupportCommand.bind(this));
  }

  private setupHandlers() {
    this.bot.on('text', this.handleTextMessage.bind(this));
  }

  private async startBot() {
    const isDev = this.configService.get('NODE_ENV') === 'development';
    
    if (isDev) {
      await this.bot.launch();
      this.logger.log('Telegram bot started in polling mode');
    } else {
      const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
      if (webhookUrl) {
        await this.setWebhook(webhookUrl);
        this.logger.log(`Webhook set to ${webhookUrl}`);
      } else {
        this.logger.warn('TELEGRAM_WEBHOOK_URL not defined, bot might not work in production');
      }
    }
  }

  private async handleStartCommand(ctx: Context) {
    const { id, username, first_name } = ctx.from;
    
    try {
      await ctx.reply(
        `Привет, ${first_name}! 👋\n\n` +
        'Добро пожаловать в DriveMe - сервис заказа премиальных автомобилей.\n\n' +
        'Доступные команды:\n' +
        '/help - Получить помощь\n' +
        '/profile - Ваш профиль\n' +
        '/orders - Ваши заказы\n' +
        '/support - Связаться с поддержкой'
      );

      this.logger.log(`New user started bot: ${id} (${username})`);
    } catch (error) {
      this.logger.error(`Error in start command for user ${id}:`, error);
    }
  }

  private async handleHelpCommand(ctx: Context) {
    await ctx.reply(
      'Команды бота:\n\n' +
      '/start - Начать работу с ботом\n' +
      '/help - Это сообщение\n' +
      '/profile - Посмотреть ваш профиль\n' +
      '/orders - Ваши заказы\n' +
      '/support - Связаться с поддержкой\n\n' +
      'Для заказа автомобиля используйте наше приложение.'
    );
  }

  private async handleProfileCommand(ctx: Context) {
    await ctx.reply(
      'Для просмотра профиля воспользуйтесь нашим приложением.'
    );
  }

  private async handleOrdersCommand(ctx: Context) {
    await ctx.reply(
      'Для просмотра заказов воспользуйтесь нашим приложением.'
    );
  }

  private async handleSupportCommand(ctx: Context) {
    await ctx.reply(
      'Служба поддержки DriveMe\n\n' +
      'По всем вопросам обращайтесь:\n' +
      'Email: support@driveme.com\n' +
      'Телефон: +7 (XXX) XXX-XX-XX\n\n' +
      'Время работы: круглосуточно'
    );
  }

  private async handleTextMessage(ctx: Context) {
    await ctx.reply(
      'Для взаимодействия с сервисом используйте команды бота или наше приложение.\n' +
      'Отправьте /help для списка доступных команд.'
    );
  }

  async sendMessage(chatId: string, message: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}:`, error);
      throw error;
    }
  }

  async setWebhook(url: string): Promise<void> {
    try {
      await this.bot.telegram.setWebhook(url);
      this.logger.log(`Webhook set to ${url}`);
    } catch (error) {
      this.logger.error('Failed to set webhook:', error);
      throw error;
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    try {
      await this.bot.handleUpdate(update);
    } catch (error) {
      this.logger.error('Failed to handle update:', error);
      throw error;
    }
  }
}