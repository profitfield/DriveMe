import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationFilter } from './filters/validation.filter';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import { securityConfig } from './config/security.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Безопасность
  app.use(helmet({
    contentSecurityPolicy: securityConfig.contentSecurityPolicy,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }));

  // CORS
  app.enableCors(securityConfig.cors);

  // Сжатие
  app.use(compression());

  // Cookie parser
  app.use(cookieParser());

  // Валидация
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false },
    })
  );

  // Обработка ошибок
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new ValidationFilter()
  );

  // Swagger документация
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DriveMe API')
      .setDescription('The DriveMe API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('orders', 'Order management endpoints')
      .addTag('drivers', 'Driver management endpoints')
      .addTag('admin', 'Admin panel endpoints')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // Запуск сервера
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || 'localhost';
  
  await app.listen(port, host);
  
  console.log(`🚀 Application is running on: http://${host}:${port}`);
  console.log(`📚 API Documentation available at: http://${host}:${port}/api`);
  console.log(`🔨 Environment: ${process.env.NODE_ENV}`);
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});