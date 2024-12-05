import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderRating1733433493460 implements MigrationInterface {
    name = 'AddOrderRating1733433493460'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем колонку rating
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD COLUMN IF NOT EXISTS "rating" DECIMAL(2,1)
        `);

        // Добавляем ограничение на диапазон значений
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "order_rating_range"
            CHECK (rating IS NULL OR (rating >= 1.0 AND rating <= 5.0))
        `);

        // Добавляем комментарий к колонке
        await queryRunner.query(`
            COMMENT ON COLUMN "orders"."rating"
            IS 'Оценка поездки клиентом от 1.0 до 5.0'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем ограничение
        await queryRunner.query(`
            ALTER TABLE "orders"
            DROP CONSTRAINT IF EXISTS "order_rating_range"
        `);

        // Удаляем колонку
        await queryRunner.query(`
            ALTER TABLE "orders"
            DROP COLUMN IF EXISTS "rating"
        `);
    }
}