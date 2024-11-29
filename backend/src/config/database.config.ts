// src/config/database.config.ts

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Driver } from '../entities/driver.entity';
import { Order } from '../entities/order.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Transaction } from '../entities/transaction.entity';

const entities = [User, Driver, Order, ChatMessage, Transaction];

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'driveme_user',
  password: process.env.DB_PASSWORD || 'driveme_pass',
  database: process.env.DB_NAME || 'driveme',
  entities,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  
  // Дополнительные настройки для продакшена
  ...(process.env.NODE_ENV === 'production' && {
    ssl: true,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  })
};