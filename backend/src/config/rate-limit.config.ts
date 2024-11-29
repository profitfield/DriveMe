// src/config/rate-limit.config.ts

export const rateLimitConfig = {
  auth: {
    login: {
      points: 5,        // 5 попыток
      duration: 300,    // за 5 минут
      keyPrefix: 'auth:login'
    },
    telegram: {
      points: 10,       // 10 попыток
      duration: 300,    // за 5 минут
      keyPrefix: 'auth:telegram'
    }
  },
  orders: {
    create: {
      points: 20,       // 20 заказов
      duration: 3600,   // в час
      keyPrefix: 'orders:create'
    },
    status: {
      points: 100,      // 100 запросов статуса
      duration: 3600,   // в час
      keyPrefix: 'orders:status'
    }
  },
  drivers: {
    location: {
      points: 360,      // обновление каждые 10 секунд
      duration: 3600,   // в час
      keyPrefix: 'drivers:location'
    },
    status: {
      points: 30,       // 30 изменений статуса
      duration: 3600,   // в час
      keyPrefix: 'drivers:status'
    }
  }
};