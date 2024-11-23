import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminTables1700670000000 implements MigrationInterface {
    name = 'CreateAdminTables1700670000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создание enum типов
        await queryRunner.query(`
            CREATE TYPE "admin_role_enum" AS ENUM (
                'super_admin',
                'admin',
                'operator',
                'finance'
            )
        `);

        await queryRunner.query(`
            CREATE TYPE "admin_action_type_enum" AS ENUM (
                'create',
                'update',
                'delete',
                'view',
                'settings',
                'status'
            )
        `);

        // Создание таблицы админов
        await queryRunner.query(`
            CREATE TABLE "admin_users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "first_name" character varying,
                "last_name" character varying,
                "role" admin_role_enum NOT NULL DEFAULT 'operator',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_admin_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
            )
        `);

        // Создание таблицы логов
        await queryRunner.query(`
            CREATE TABLE "admin_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "admin_id" uuid NOT NULL,
                "action" admin_action_type_enum NOT NULL,
                "details" jsonb NOT NULL,
                "entity_type" character varying,
                "entity_id" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admin_logs" PRIMARY KEY ("id"),
                CONSTRAINT "FK_admin_logs_admin" FOREIGN KEY ("admin_id") 
                    REFERENCES "admin_users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
            )
        `);

        // Создание таблицы настроек
        await queryRunner.query(`
            CREATE TABLE "admin_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" character varying NOT NULL,
                "value" jsonb NOT NULL,
                "description" character varying,
                "is_system" boolean NOT NULL DEFAULT false,
                "version" integer NOT NULL DEFAULT 1,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_admin_settings_key" UNIQUE ("key"),
                CONSTRAINT "PK_admin_settings" PRIMARY KEY ("id")
            )
        `);

        // Добавление базовых настроек
        await queryRunner.query(`
            INSERT INTO "admin_settings" ("key", "value", "description", "is_system")
            VALUES 
            ('commission_rate', '0.25', 'Комиссия сервиса (25%)', true),
            ('min_driver_rating', '4.0', 'Минимальный рейтинг водителя', true),
            ('order_auto_cancel_minutes', '15', 'Время автоматической отмены заказа, если водитель не найден', true)
        `);

        // Создание супер-админа (пароль нужно будет сменить)
        await queryRunner.query(`
            INSERT INTO "admin_users" (email, password, first_name, last_name, role)
            VALUES (
                'admin@driveme.com',
                '$2b$10$YourHashedPasswordHere', -- Нужно заменить на реальный хеш пароля
                'System',
                'Administrator',
                'super_admin'
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "admin_logs"`);
        await queryRunner.query(`DROP TABLE "admin_settings"`);
        await queryRunner.query(`DROP TABLE "admin_users"`);
        await queryRunner.query(`DROP TYPE "admin_action_type_enum"`);
        await queryRunner.query(`DROP TYPE "admin_role_enum"`);
    }
}