import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1710000000000 implements MigrationInterface {
    name = 'InitialMigration1710000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем расширение для UUID
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Users table
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "telegram_id" VARCHAR UNIQUE NOT NULL,
                "username" VARCHAR,
                "first_name" VARCHAR,
                "last_name" VARCHAR,
                "phone_number" VARCHAR,
                "bonus_balance" DECIMAL(10,2) DEFAULT 0,
                "referral_code" VARCHAR UNIQUE,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Drivers table
        await queryRunner.query(`
            CREATE TYPE "driver_status_enum" AS ENUM ('offline', 'online', 'busy', 'break');
            CREATE TYPE "car_class_enum" AS ENUM ('premium', 'premium_large', 'elite');
            
            CREATE TABLE "drivers" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" uuid REFERENCES "users" (id),
                "car_class" car_class_enum NOT NULL,
                "status" driver_status_enum DEFAULT 'offline',
                "car_info" jsonb NOT NULL,
                "rating" DECIMAL(3,2) DEFAULT 5.00,
                "commission_balance" DECIMAL(10,2) DEFAULT 0,
                "total_rides" INTEGER DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Orders table
        await queryRunner.query(`
            CREATE TYPE "order_type_enum" AS ENUM ('pre_order', 'hourly', 'airport');
            CREATE TYPE "order_status_enum" AS ENUM (
                'created', 'driver_assigned', 'confirmed', 
                'en_route', 'arrived', 'started', 
                'completed', 'cancelled'
            );
            CREATE TYPE "payment_type_enum" AS ENUM ('cash', 'bonus', 'mixed');

            CREATE TABLE "orders" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "client_id" uuid REFERENCES "users" (id),
                "driver_id" uuid REFERENCES "drivers" (id),
                "type" order_type_enum NOT NULL,
                "status" order_status_enum DEFAULT 'created',
                "car_class" car_class_enum NOT NULL,
                "pickup_datetime" TIMESTAMP WITH TIME ZONE NOT NULL,
                "pickup_address" jsonb NOT NULL,
                "destination_address" jsonb,
                "duration_hours" INTEGER,
                "price" DECIMAL(10,2) NOT NULL,
                "commission" DECIMAL(10,2) NOT NULL,
                "payment_type" payment_type_enum DEFAULT 'cash',
                "bonus_payment" DECIMAL(10,2) DEFAULT 0,
                "cancellation_reason" TEXT,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Chat messages table
        await queryRunner.query(`
            CREATE TYPE "message_type_enum" AS ENUM ('text', 'location', 'system');
            CREATE TYPE "message_status_enum" AS ENUM ('sent', 'delivered', 'read');

            CREATE TABLE "chat_messages" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "order_id" uuid REFERENCES "orders" (id),
                "sender_id" uuid REFERENCES "users" (id),
                "recipient_id" uuid REFERENCES "users" (id),
                "content" TEXT NOT NULL,
                "type" message_type_enum DEFAULT 'text',
                "status" message_status_enum DEFAULT 'sent',
                "metadata" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Transactions table
        await queryRunner.query(`
            CREATE TYPE "transaction_type_enum" AS ENUM ('payment', 'commission', 'bonus');
            CREATE TYPE "transaction_status_enum" AS ENUM ('pending', 'completed', 'failed');

            CREATE TABLE "transactions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "order_id" uuid REFERENCES "orders" (id),
                "driver_id" uuid REFERENCES "drivers" (id),
                "type" transaction_type_enum NOT NULL,
                "status" transaction_status_enum DEFAULT 'pending',
                "amount" DECIMAL(10,2) NOT NULL,
                "commission" DECIMAL(10,2) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "transactions" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "transaction_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "message_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "message_type_enum"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "payment_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "order_type_enum"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "drivers" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "car_class_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "driver_status_enum"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    }
}