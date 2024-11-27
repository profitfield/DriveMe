import { Module } from '@nestjs/common';
import { EncryptionService } from '../services/encryption.service';
import { SecureStorageService } from '../services/secure-storage.service';
import { SecurityLogger } from '../services/logger.service';

@Module({
  providers: [
    EncryptionService,
    SecureStorageService,
    SecurityLogger
  ],
  exports: [
    EncryptionService,
    SecureStorageService
  ]
})
export class SecurityModule {}