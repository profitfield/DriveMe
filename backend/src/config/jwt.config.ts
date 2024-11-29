// src/config/jwt.config.ts

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  refreshToken: {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
};