// backend/src/database/migrations/1733331888369-AddOrderEnhancements.ts

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderEnhancements1733331888369 implements MigrationInterface {
    name = 'AddOrderEnhancements1733331888369'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- Добавляем уникальный генерируемый номер заказа
            ALTER TABLE "orders" 
            ADD COLUMN "order_number" VARCHAR(20) UNIQUE,
            ADD CONSTRAINT "order_number_not_null" CHECK ("order_number" IS NOT NULL);

            -- Добавляем поля для работы с ценами
            ALTER TABLE "orders"
            ADD COLUMN "estimated_price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            ADD COLUMN "actual_price" DECIMAL(10,2),
            ADD COLUMN "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            ADD CONSTRAINT "payment_status_check" CHECK (
                payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')
            );

            -- Создаем индексы для оптимизации запросов
            CREATE INDEX "idx_orders_status_datetime" 
            ON "orders"("status", "pickup_datetime");
            
            CREATE INDEX "idx_drivers_status_class" 
            ON "drivers"("status", "car_class");
            
            CREATE INDEX "idx_users_telegram" 
            ON "users"("telegram_id");

            -- Добавляем триггер для автоматической генерации номера заказа
            CREATE OR REPLACE FUNCTION generate_order_number()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.order_number := 'ORD-' || to_char(NEW.created_at, 'YYMMDD') || '-' || 
                                  LPAD(CAST(nextval('order_number_seq') AS VARCHAR), 4, '0');
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            -- Создаем последовательность для номеров заказов
            CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

            -- Создаем триггер
            CREATE TRIGGER set_order_number
                BEFORE INSERT ON "orders"
                FOR EACH ROW
                EXECUTE FUNCTION generate_order_number();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- Удаляем триггер и функцию
            DROP TRIGGER IF EXISTS set_order_number ON "orders";
            DROP FUNCTION IF EXISTS generate_order_number();
            DROP SEQUENCE IF EXISTS order_number_seq;

            -- Удаляем индексы
            DROP INDEX IF EXISTS "idx_orders_status_datetime";
            DROP INDEX IF EXISTS "idx_drivers_status_class";
            DROP INDEX IF EXISTS "idx_users_telegram";

            -- Удаляем ограничения
            ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "payment_status_check";
            ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "order_number_not_null";

            -- Удаляем колонки
            ALTER TABLE "orders"
            DROP COLUMN IF EXISTS "order_number",
            DROP COLUMN IF EXISTS "estimated_price",
            DROP COLUMN IF EXISTS "actual_price",
            DROP COLUMN IF EXISTS "payment_status";
        `);
    }
}