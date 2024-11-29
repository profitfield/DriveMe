import { Module, forwardRef, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

// Конфигурация
import { databaseConfig } from './config/database.config';
import { securityConfig } from './config/security.config';
import { websocketConfig } from './config/websocket.config';

// Сущности
import { User } from './entities/user.entity';
import { Driver } from './entities/driver.entity';
import { Order } from './entities/order.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AdminLog } from './entities/admin-log.entity';
import { AdminSettings } from './entities/admin-settings.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Notification } from './entities/notification.entity';
import { FileUpload } from './entities/file-upload.entity';
import { Session } from './entities/session.entity';
import { Transaction } from './entities/transaction.entity';
import { SuspiciousActivity } from './entities/suspicious-activity.entity';

// Модули
import { UsersModule } from './modules/users.module';
import { DriversModule } from './modules/drivers.module';
import { OrdersModule } from './modules/orders.module';
import { AdminModule } from './modules/admin.module';
import { RedisModule } from './modules/redis.module';
import { SecurityModule } from './modules/security.module';
import { AuthModule } from './modules/auth.module';
import { WebSocketModule } from './modules/websocket.module';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { SecurityMonitoringGuard } from './guards/security-monitoring.guard';
import { BruteforceGuard } from './guards/bruteforce.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { AccessControlGuard } from './guards/access-control.guard';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';
import { CsrfMiddleware } from './middleware/csrf.middleware';

// Services
import { SecurityLogger } from './services/logger.service';
import { EncryptionService } from './services/encryption.service';
import { SecureStorageService } from './services/secure-storage.service';
import { BruteforceProtectionService } from './services/bruteforce-protection.service';
import { CsrfService } from './services/csrf.service';
import { SecureFileStorageService } from './services/secure-file-storage.service';
import { SecureChatService } from './services/secure-chat.service';
import { AuditService } from './services/audit.service';
import { SecureNotificationService } from './services/secure-notification.service';
import { SecureUploadService } from './services/secure-upload.service';
import { SessionManagementService } from './services/session-management.service';
import { SecureTransactionService } from './services/secure-transaction.service';
import { SuspiciousActivityService } from './services/suspicious-activity.service';
import { ContentValidationService } from './services/content-validation.service';
import { APISecurityService } from './services/api-security.service';
import { WebSocketSecurityService } from './services/websocket-security.service';
import { AccessControlService } from './services/access-control.service';
import { AntivirusService } from './services/antivirus.service';

@Module({
  imports: [
    // Конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({ security: securityConfig }),
        () => ({ websocket: websocketConfig })
      ],
      envFilePath: ['.env', `.env.${process.env.NODE_ENV}`],
    }),

    // База данных
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([
      User,
      Driver,
      Order,
      AdminUser,
      AdminLog,
      AdminSettings,
      ChatMessage,
      AuditLog,
      Notification,
      FileUpload,
      Session,
      Transaction,
      SuspiciousActivity
    ]),

    // Аутентификация
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get('JWT_EXPIRES_IN', '30d')
        },
      }),
      inject: [ConfigService],
    }),

    // Основные модули
    RedisModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    DriversModule,
    OrdersModule,
    AdminModule,
    WebSocketModule,
  ],
  providers: [
    // Security Services
    SecurityLogger,
    EncryptionService,
    SecureStorageService,
    BruteforceProtectionService,
    CsrfService,
    SecureFileStorageService,
    SecureChatService,
    AuditService,
    SecureNotificationService,
    SecureUploadService,
    SessionManagementService,
    SecureTransactionService,
    SuspiciousActivityService,
    ContentValidationService,
    APISecurityService,
    WebSocketSecurityService,
    AccessControlService,
    AntivirusService,

    // Global Guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminRolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SecurityMonitoringGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BruteforceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessControlGuard,
    }
  ],
  exports: [
    // Export security services for use in other modules
    SecurityLogger,
    EncryptionService,
    SecureStorageService,
    BruteforceProtectionService,
    CsrfService,
    SecureFileStorageService,
    SecureChatService,
    AuditService,
    SecureNotificationService,
    SecureUploadService,
    SessionManagementService,
    SecureTransactionService,
    SuspiciousActivityService,
    ContentValidationService,
    APISecurityService,
    WebSocketSecurityService,
    AccessControlService,
    AntivirusService,
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*');

    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');
    
    consumer
      .apply(CsrfMiddleware)
      .forRoutes('*');

    consumer
      .apply(APISecurityService)
      .forRoutes('*');
  }
}
