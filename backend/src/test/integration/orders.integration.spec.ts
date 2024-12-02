// src/test/integration/orders.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrderType, OrderStatus } from '../../entities/order.entity';
import { CarClass } from '../../entities/driver.entity';
import { JwtService } from '@nestjs/jwt';

describe('Orders (Integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let testUserToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test'
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('DB_HOST'),
            port: configService.get('DB_PORT'),
            username: configService.get('DB_USER'),
            password: configService.get('DB_PASSWORD'),
            database: configService.get('DB_NAME'),
            entities: ['src/entities/*.entity.ts'],
            synchronize: true // только для тестов
          }),
          inject: [ConfigService],
        }),
        AppModule
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    
    // Создаем тестовый JWT токен
    testUserToken = jwtService.sign({
      sub: 'test-user-id',
      telegramId: 'test-telegram-id'
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Order Creation Flow', () => {
    it('should create order and assign driver', async () => {
      const orderData = {
        type: OrderType.PRE_ORDER,
        carClass: CarClass.PREMIUM,
        pickupDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pickupAddress: {
          address: 'Test Address',
          latitude: 55.7558,
          longitude: 37.6173
        }
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(OrderStatus.CREATED);
      expect(response.body.price).toBeGreaterThan(0);
      expect(response.body.commission).toBeGreaterThan(0);

      // Сохраняем ID заказа для следующих тестов
      const orderId = response.body.id;

      // Проверяем возможность получить созданный заказ
      await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(orderId);
        });

      // Проверяем обновление статуса
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ status: OrderStatus.DRIVER_ASSIGNED })
        .expect(200)
        .expect(res => {
          expect(res.body.status).toBe(OrderStatus.DRIVER_ASSIGNED);
        });
    });

    it('should handle order cancellation', async () => {
      const orderData = {
        type: OrderType.PRE_ORDER,
        carClass: CarClass.PREMIUM,
        pickupDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pickupAddress: {
          address: 'Test Address',
          latitude: 55.7558,
          longitude: 37.6173
        }
      };

      // Создаем заказ
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(orderData)
        .expect(201);

      const orderId = createResponse.body.id;

      // Отменяем заказ
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(200)
        .expect(res => {
          expect(res.body.status).toBe(OrderStatus.CANCELLED);
          expect(res.body.cancellationReason).toBe('Test cancellation');
        });
    });

    it('should calculate prices correctly', async () => {
      const orderData = {
        type: OrderType.HOURLY,
        carClass: CarClass.PREMIUM,
        pickupDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pickupAddress: {
          address: 'Test Address',
          latitude: 55.7558,
          longitude: 37.6173
        },
        durationHours: 2
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(orderData)
        .expect(201);

      // Проверяем расчет цены с учетом скидки
      expect(response.body.price).toBe(7980); // 4200 * 2 = 8400 - 5% = 7980
      expect(response.body.commission).toBe(1995); // 25% от 7980
    });
  });

  describe('Order Management', () => {
    it('should get active orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/active')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('status');
      }
    });

    it('should get order statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/stats')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('completed');
      expect(response.body).toHaveProperty('cancelled');
      expect(response.body).toHaveProperty('revenue');
    });
  });
});