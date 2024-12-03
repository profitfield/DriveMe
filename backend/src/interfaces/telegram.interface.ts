// src/interfaces/telegram.interface.ts

export interface TelegramUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  }
  
  export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }
  
  export interface TelegramMessage {
    message_id: number;
    from: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
    caption?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }
  
  export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
    callback_query?: {
      id: string;
      from: TelegramUser;
      message?: TelegramMessage;
      data: string;
    };
  }
  
  export interface TelegramWebhookUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
  }