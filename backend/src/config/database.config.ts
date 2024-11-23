import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Driver } from '../entities/driver.entity';
import { Order } from '../entities/order.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USER || 'driveme_user',
  password: process.env.DB_PASSWORD || 'driveme_pass',
  database: process.env.DB_NAME || 'driveme',
  entities: [User, Driver, Order],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
};