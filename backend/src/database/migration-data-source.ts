// src/database/migration-data-source.ts

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../entities/user.entity';
import { Driver } from '../entities/driver.entity';
import { Order } from '../entities/order.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Transaction } from '../entities/transaction.entity';

config();

export const MigrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'driveme_user',
  password: process.env.DB_PASSWORD || 'driveme_pass',
  database: process.env.DB_NAME || 'driveme',
  synchronize: false,
  logging: true,
  entities: [User, Driver, Order, ChatMessage, Transaction],
  migrations: [],
  migrationsTableName: 'typeorm_migrations'
});