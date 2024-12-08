// src/database/migrations/1733607547896-AddOrderTimeTracking.ts

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderTimeTracking1733607547896 implements MigrationInterface {
    name = 'AddOrderTimeTracking1733607547896'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD COLUMN "confirmed_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN "started_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN "completed_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN "cancelled_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN "start_location" JSONB,
            ADD COLUMN "estimated_arrival_time" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN "rating_comment" TEXT;
            
            -- Добавляем комментарии для документации
            COMMENT ON COLUMN "orders"."confirmed_at" IS 'Время подтверждения заказа';
            COMMENT ON COLUMN "orders"."started_at" IS 'Время начала поездки';
            COMMENT ON COLUMN "orders"."completed_at" IS 'Время завершения поездки';
            COMMENT ON COLUMN "orders"."cancelled_at" IS 'Время отмены заказа';
            COMMENT ON COLUMN "orders"."start_location" IS 'Начальная локация водителя';
            COMMENT ON COLUMN "orders"."estimated_arrival_time" IS 'Расчетное время прибытия';
            COMMENT ON COLUMN "orders"."rating_comment" IS 'Комментарий к оценке';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "orders"
            DROP COLUMN "confirmed_at",
            DROP COLUMN "started_at",
            DROP COLUMN "completed_at",
            DROP COLUMN "cancelled_at",
            DROP COLUMN "start_location",
            DROP COLUMN "estimated_arrival_time",
            DROP COLUMN "rating_comment";
        `);
    }
}