import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScanStatusToFileUploads1732879207175 implements MigrationInterface {
    name = 'AddScanStatusToFileUploads1732879207175';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем enum тип если его еще нет
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "file_scan_status_enum" AS ENUM (
                    'pending',
                    'scanning',
                    'clean',
                    'infected',
                    'error'
                );
            EXCEPTION 
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Создаем таблицу если она не существует
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "file_uploads" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "category" varchar NOT NULL,
                "original_name" varchar NOT NULL,
                "filename" varchar NOT NULL,
                "mime_type" varchar NOT NULL,
                "size" bigint NOT NULL,
                "checksum" varchar NOT NULL,
                "path" varchar NOT NULL,
                "metadata" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "last_accessed_at" TIMESTAMP WITH TIME ZONE,
                "scan_status" file_scan_status_enum NOT NULL DEFAULT 'pending',
                "scan_result" jsonb
            )
        `);

        // Обновляем существующие записи
        await queryRunner.query(`
            UPDATE "file_uploads"
            SET "scan_status" = 'clean',
            "scan_result" = '{"timestamp": NOW(), "viruses": []}'::jsonb
            WHERE "scan_status" = 'pending'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем таблицу
        await queryRunner.query(`
            DROP TABLE IF EXISTS "file_uploads"
        `);

        // Удаляем enum тип
        await queryRunner.query(`
            DROP TYPE IF EXISTS "file_scan_status_enum"
        `);
    }
}