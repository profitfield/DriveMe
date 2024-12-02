// src/config/rate-limit.config.ts

export const rateLimitConfig = {
  auth: {
    login: {
      points: 5,        // 5 attempts
      duration: 300,    // per 5 minutes
      keyPrefix: 'auth:login'
    },
    telegram: {
      points: 10,       // 10 attempts
      duration: 300,    // per 5 minutes
      keyPrefix: 'auth:telegram'
    }
  },
  orders: {
    create: {
      points: 20,       // 20 orders
      duration: 3600,   // per hour
      keyPrefix: 'orders:create'
    },
    status: {
      points: 100,      // 100 status requests
      duration: 3600,   // per hour
      keyPrefix: 'orders:status'
    }
  },
  drivers: {
    location: {
      points: 360,      // update every 10 seconds
      duration: 3600,   // per hour
      keyPrefix: 'drivers:location'
    },
    status: {
      points: 30,       // 30 status changes
      duration: 3600,   // per hour
      keyPrefix: 'drivers:status'
    }
  }
};