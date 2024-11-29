import { registerAs } from '@nestjs/config';

export const websocketConfig = {
  // Общие настройки WebSocket сервера
  server: {
    port: process.env.WS_PORT || 3001,
    path: '/ws',
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  },

  // Настройки безопасности
  security: {
    // Максимальное количество одновременных подключений
    maxConnections: 1000,

    // Ограничение количества сообщений
    messageRateLimit: {
      maxMessages: 100, // максимальное количество сообщений
      timeWindow: 60    // за 60 секунд
    },

    // Ограничение размера сообщений
    maxMessageSize: 16384, // 16KB

    // Настройки проверки соединения
    pingInterval: 30000,  // 30 секунд между ping
    timeout: 120000,      // 2 минуты до отключения без ответа
    
    // Фильтрация сообщений
    messageFilters: {
      // Запрещенные паттерны в сообщениях
      blockedPatterns: [
        '<script',
        'javascript:',
        'data:',
        'vbscript:',
        'onload=',
        'onerror='
      ],
      // Максимальная длина различных типов сообщений
      maxLengths: {
        chat: 1000,
        location: 100,
        status: 50
      }
    }
  },

  // Каналы для различных типов сообщений
  channels: {
    chat: 'chat',               // Чат между водителем и клиентом
    orders: 'orders',           // Обновления статусов заказов
    locations: 'locations',     // Обновления местоположения
    notifications: 'notifications',  // Системные уведомления
    presence: 'presence'        // Статусы присутствия пользователей
  },

  // Настройки шифрования
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keyRotationInterval: 86400000  // 24 часа
  },

  // Настройки аудита
  audit: {
    enabled: true,
    logLevel: 'info',
    excludedEvents: ['ping', 'pong']
  }
};