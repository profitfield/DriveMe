import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'driveme_user',
    password: process.env.DB_PASSWORD || 'driveme_pass',
    database: process.env.DB_NAME || 'driveme',
    entities: ['src/entities/**/*.entity.ts'],
    migrations: ['src/database/migrations/**/*.ts'],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
});