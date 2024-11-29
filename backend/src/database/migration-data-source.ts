import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { FileUpload } from '../entities/file-upload.entity';
import { AdminUser } from '../entities/admin-user.entity';

// Загружаем переменные окружения
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
  entities: [FileUpload, AdminUser], // Добавляем необходимые сущности
  migrations: ['src/database/migrations/*-AddScanStatusToFileUploads.ts'], // Указываем только нужную миграцию
  migrationsTableName: 'typeorm_migrations'
});