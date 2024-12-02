import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Entities
import { User } from '../entities/user.entity';
import { Driver } from '../entities/driver.entity';
import { Order } from '../entities/order.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Transaction } from '../entities/transaction.entity';

// Загружаем переменные окружения
config();

const options: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Driver, Order, ChatMessage, Transaction],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export const MigrationDataSource = new DataSource(options);